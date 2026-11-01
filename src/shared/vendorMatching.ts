import type { BudgetCategory, PlanOutput, Vendor } from './schemas.js';

const groups = [
  /cater|food|prasad|bhandara|भोजन|कैटर/i,
  /decor|floral|florist|mandap|सजावट/i,
  /venue|hall|स्थान/i,
  /photo|video|फोटो/i,
  /sound|lighting|dj|entertainment|emcee|कलाकार/i,
  /pandal|shamiana|पंडाल/i,
  /permission|noc|municipal|police|अनुमति/i,
  /cake|confection|केक/i,
  /return gift|favour|favor|memento|उपहार/i,
];
const normalize = (text: string): string => text.trim().toLowerCase();

/** Resolve semantic checklist names without coupling them to chosen businesses. */
export function matchVendorBudgetCategory(
  plan: PlanOutput,
  vendor: Vendor,
): BudgetCategory | undefined {
  const explicit = plan.budget.find((category) => category.id === vendor.budgetCategoryId);
  if (explicit) return explicit;
  const name = normalize(vendor.category);
  const candidates = plan.budget.flatMap((category, index) => {
    if (/contingency/i.test(category.category)) return [];
    if (
      vendor.subEvent &&
      category.subEvent &&
      vendor.subEvent !== category.subEvent &&
      category.subEvent !== 'General'
    )
      return [];
    const budgetName = normalize(category.category);
    const similarity =
      budgetName === name
        ? 100
        : budgetName.includes(name) || name.includes(budgetName)
          ? 80
          : groups.some((group) => group.test(name) && group.test(budgetName))
            ? 50
            : 0;
    if (similarity === 0) return [];
    const ceremony = vendor.subEvent === category.subEvent ? 20 : 0;
    return [{ category, score: similarity + ceremony, index }];
  });
  candidates.sort((left, right) => right.score - left.score || left.index - right.index);
  return candidates[0]?.category;
}
