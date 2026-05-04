# OC World Frontend UX Direction: Simple Presence

## Design Principle

Borrow Apple-like interaction principles without copying iOS chrome:

- Hierarchy: conversation is the primary content; navigation and memory stay quiet.
- Harmony: avatar, chat lane, receipt, and composer share one stable center column.
- Consistency: controls keep the same size, tone, and response pattern across chat and memory.
- Material: layers show depth only when they explain where content lives.
- Feedback: every action returns a nearby status, not a detached system message.

## Interaction Model

1. The user enters from conversation, not from a dashboard.
2. The OC is always present as a small companion, but never competes with chat.
3. Sending a message creates a visible thinking state in the same chat lane.
4. A turn receipt appears after every turn and states whether a clue exists.
5. Memory opens as a side sheet. It never replaces the conversation.
6. Confirmation actions use short verbs: `确认`, `稍后`, `不对`, `对`.
7. The sheet gives immediate local feedback after each click.
8. Closing the sheet returns to the exact same conversation context.

## MVP Quality Bar

- One primary action per surface.
- Controls are at least 44px tall when touch-like.
- Text is calm and concrete; no system-dashboard vocabulary.
- Background is neutral, not beige-heavy, with one restrained accent.
- No decorative cards inside cards.
