import ts from 'typescript';

const secretNames = new Set(['GEMINI_API_KEY', 'GOOGLE_MAPS_API_KEY']);
const comparisons = new Set([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.InKeyword,
  ts.SyntaxKind.InstanceOfKeyword,
]);

/** Local AST/data-flow guard: response values must not derive from server credentials. */
export function secretResponseLeakLines(text: string): number[] {
  const fileName = '/route.ts';
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const options: ts.CompilerOptions = { noLib: true, noResolve: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (path) => (path === fileName ? source : undefined);
  host.fileExists = (path) => path === fileName;
  host.readFile = (path) => (path === fileName ? text : undefined);
  const checker = ts.createProgram([fileName], options, host).getTypeChecker();
  const assignments = new Map<ts.Symbol, ts.Expression[]>();
  function collect(node: ts.Node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const symbol = checker.getSymbolAtLocation(node.left);
      if (symbol) assignments.set(symbol, [...(assignments.get(symbol) ?? []), node.right]);
    }
    ts.forEachChild(node, collect);
  }
  collect(source);

  function name(node: ts.Node): string | undefined {
    return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined;
  }
  function isEnvironment(node: ts.Node, seen = new Set<ts.Symbol>()): boolean {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'process' &&
      node.name.text === 'env'
    )
      return true;
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      if (!symbol || seen.has(symbol)) return false;
      const next = new Set(seen).add(symbol);
      return (
        symbol.declarations?.some((declaration) =>
          ts.isVariableDeclaration(declaration) && declaration.initializer
            ? isEnvironment(declaration.initializer, next)
            : false,
        ) ?? false
      );
    }
    return ts.isParenthesizedExpression(node) && isEnvironment(node.expression, seen);
  }
  function derived(node: ts.Node, seen = new Set<ts.Symbol>()): boolean {
    if (isEnvironment(node)) return true;
    if (ts.isPropertyAccessExpression(node) && isEnvironment(node.expression)) {
      return secretNames.has(node.name.text);
    }
    if (ts.isElementAccessExpression(node) && isEnvironment(node.expression)) {
      return (
        ts.isStringLiteral(node.argumentExpression) && secretNames.has(node.argumentExpression.text)
      );
    }
    if (ts.isIdentifier(node)) {
      const symbol =
        ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
          ? checker.getShorthandAssignmentValueSymbol(node.parent)
          : checker.getSymbolAtLocation(node);
      if (!symbol || seen.has(symbol)) return false;
      const next = new Set(seen).add(symbol);
      if (assignments.get(symbol)?.some((value) => derived(value, next))) return true;
      return (
        symbol.declarations?.some((declaration) => {
          if (ts.isVariableDeclaration(declaration)) {
            return declaration.initializer ? derived(declaration.initializer, next) : false;
          }
          if (ts.isBindingElement(declaration)) {
            const parent = declaration.parent.parent;
            if (!ts.isVariableDeclaration(parent) || !parent.initializer) return false;
            const property = declaration.propertyName ?? declaration.name;
            return isEnvironment(parent.initializer)
              ? secretNames.has(name(property) ?? '')
              : derived(parent.initializer, next);
          }
          return false;
        }) ?? false
      );
    }
    // Presence/status metadata does not contain credential material.
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken)
      return false;
    if (ts.isTypeOfExpression(node)) return false;
    if (ts.isBinaryExpression(node) && comparisons.has(node.operatorToken.kind)) return false;
    if (ts.isConditionalExpression(node))
      return derived(node.whenTrue, seen) || derived(node.whenFalse, seen);
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Boolean' &&
      !checker.getSymbolAtLocation(node.expression)
    )
      return false;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) {
        return (
          ['String', 'encodeURIComponent', 'encodeURI', 'btoa', 'atob'].includes(callee.text) &&
          node.arguments.some((argument) => derived(argument, seen))
        );
      }
      if (ts.isPropertyAccessExpression(callee)) {
        const stringify =
          ts.isIdentifier(callee.expression) &&
          callee.expression.text === 'JSON' &&
          callee.name.text === 'stringify';
        return (
          derived(callee.expression, seen) ||
          (stringify && node.arguments.some((argument) => derived(argument, seen)))
        );
      }
      return false;
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'length') return false;
    return node.getChildren(source).some((child) => derived(child, seen));
  }
  function response(node: ts.Expression, seen = new Set<ts.Symbol>()): boolean {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      return response(node.expression.expression, seen);
    }
    if (!ts.isIdentifier(node)) return false;
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol || seen.has(symbol)) return /^(?:res|response|reply)$/.test(node.text);
    const next = new Set(seen).add(symbol);
    return (
      symbol.declarations?.some((declaration) => {
        if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
          return response(declaration.initializer, next);
        }
        if (!ts.isParameter(declaration)) return false;
        if (/^(?:res|response|reply)$/.test(node.text)) return true;
        const fn = declaration.parent;
        if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return false;
        const call = fn.parent;
        return (
          fn.parameters[1] === declaration &&
          ts.isCallExpression(call) &&
          ts.isPropertyAccessExpression(call.expression) &&
          ['get', 'post', 'put', 'patch', 'delete', 'all', 'use'].includes(
            call.expression.name.text,
          )
        );
      }) ?? false
    );
  }
  const lines: number[] = [];
  function inspect(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ['json', 'send'].includes(name(node.expression.name) ?? '') &&
      response(node.expression.expression) &&
      node.arguments.some((argument) => derived(argument))
    )
      lines.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
    ts.forEachChild(node, inspect);
  }
  inspect(source);
  return lines;
}
