# How the AI models work

## Three perspectives, no single owner

Every claim is investigated independently by at least three models, chosen for their different perceived leanings and countries of origin:

- a US model widely perceived as right-leaning (for example xAI's Grok);
- a US model widely perceived as left-leaning (for example OpenAI's GPT, Anthropic's Claude or Google's Gemini);
- a Chinese model (for example DeepSeek, Kimi, Qwen or GLM), perceived as left-leaning on many social questions and aligned with Chinese government positions on China-related topics.

These labels describe how people across the political spectrum tend to **perceive** each model family (Westwood, Grimmer & Hall, 2025). They are not instructions. Every model gets exactly the same neutral, accuracy-first prompt, and no model is ever asked to take a side. The point is that their different starting assumptions check each other.

The lineup must always have at least three models, from at least two countries and three companies. No company handles more than half of all investigations.

## The investigation

Each model works through the same toolset: web search, reading pages, official statistics, quote checking and an entity lookup. Grok models can also search X, which helps trace where a viral claim came from. Posts on X count only as context.

## Combining verdicts

A published rule combines the verdicts, not another model:

1. The median grade wins.
2. Confidence drops when verdicts spread.
3. If verdicts are two or more grades apart, or one says supported and another contradicted, the analysis shows **"Models disagree"**, shows every rationale, and goes to a person for review.
4. A refusal counts as an abstention.
5. **Conflicts of interest**: a model's vote is not counted on topics about its own maker or government (for example Grok on Elon Musk's companies, GPT on OpenAI, Chinese models on Taiwan or Xinjiang). Its view is still shown.
6. If fewer than two verdicts remain, a person must review before publication.

## Changes

Models can be swapped. Every change is tested, recorded with a reason, and listed on the model lineup page. Past analyses keep the grades they were published with.
