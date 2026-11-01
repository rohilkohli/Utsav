export function LandingHero() {
  return (
    <section className="container landing-hero" aria-labelledby="welcome-title">
      <p>🎯 Hack2Skill × VirtualPromptWars — Challenge 5</p>
      <h1 id="welcome-title">Plan Your Celebration, The Indian Way 🎉</h1>
      <p>
        Smart multi-ceremony wedding budgets, birthday celebrations, and community festival
        permission checklists, with culturally personalized ideas and deterministic rupee math.
      </p>
      <div className="dashboard-grid" role="list" aria-label="Key features">
        {[
          [
            '💰 Zero Rupee Drift',
            'Largest-Remainder math keeps budget allocations exact to the rupee.',
          ],
          [
            '⏳ IST-Aware Timeline',
            'Dependency-aware milestones, delay propagation, calendar exports, and Google Calendar links.',
          ],
          [
            '🤝 Vendor Questionnaire',
            'Compare real quotations, find vendors through Google Places, and track Police NOC and Municipal permits.',
          ],
          [
            '✨ English, Hindi & Hinglish',
            'Creative ideas and a grounded planning assistant, with instant curated fallback plans.',
          ],
        ].map(([title, text]) => (
          <div role="listitem" key={title} className="dashboard-card">
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <section aria-label="How it works" className="dashboard-card">
        <h2>How it works — 5 steps in under 2 minutes</h2>
        <p>
          Pick your event type and ceremonies → add date, city and guests → set your budget →
          describe your vibe → generate your celebration plan.
        </p>
      </section>
    </section>
  );
}
