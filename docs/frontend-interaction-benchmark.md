# OC World Frontend Interaction Benchmark

This benchmark turns the MVP interaction direction into concrete checks. The goal is not to make the UI look busier; it is to make the OC feel present while conversation remains the primary path.

## Benchmark

| Dimension | Weight | Acceptance criteria |
| --- | ---: | --- |
| Conversation is the main stage | 20 | The first visible path is speaking to the OC. Secondary surfaces never erase the active thread or composer. |
| Spatial alignment and layout stability | 20 | Avatars, names, bubbles, discovery cards, and composer share one stable content column. Opening side panels does not shift the chat lane unexpectedly. |
| Low-presence companion | 15 | The OC stays visible as a quiet presence. Controls are small but understandable without exposing system-dashboard language. |
| Response loop | 15 | Send, pending, interrupt, follow-up, and error/recovery states are visible at the point of conversation. |
| Progressive memory disclosure | 15 | Memory appears as a side note only when asked or when a real clue emerges. It must be dismissible and must not sit in the accessibility tree when closed. |
| Browser and accessibility robustness | 15 | The browser demo has a useful fallback, controls have labels/titles, hidden panels are not focusable, and mobile constraints preserve alignment. |

## Current MVP Score Before This Pass

| Dimension | Score | Main issue found |
| --- | ---: | --- |
| Conversation is the main stage | 13 / 20 | The memory drawer can become the effective main page, leaving the chat area blank. |
| Spatial alignment and layout stability | 17 / 20 | Message/composer columns are now aligned, but side-panel state still changes the perceived stage. |
| Low-presence companion | 10 / 15 | The rail is visually quiet, but "线" is too cryptic for a user or investor demo. |
| Response loop | 10 / 15 | Pending state reads as raw ellipsis instead of an intentional listening/thinking state. |
| Progressive memory disclosure | 9 / 15 | Closed memory content can still remain structurally present, and the drawer label still mentions the wrong default name. |
| Browser and accessibility robustness | 11 / 15 | Browser demo fallback exists, but hidden/secondary surfaces need stricter state control. |

Total: 70 / 100

## MVP Target For This Pass

Reach 84+ by fixing the state model before polishing visuals:

- Keep `chat` as the underlay whenever memory opens.
- Treat memory as a dismissible side note, not a route that replaces conversation.
- Remove hidden drawer content when closed.
- Make rail controls understandable in screenshots.
- Replace raw waiting text with a deliberate pending state.
- Preserve the aligned chat/composer column across desktop and mobile.

## Implemented Interaction Path

1. User opens chat and types a real sentence in the composer.
2. Submit clears the input, pins the user's sentence in the thread, and shows the OC thinking state.
3. The browser MVP fallback waits long enough for the thinking state to be visible, then returns an OC reply.
4. The turn receipt appears in the chat lane and explains whether the turn is still being understood, already stored, or waiting for calibration.
5. If a clue emerges, the chat shows a discovery card and the left presence rail switches into a stronger signal state.
6. User opens `小纸条` from the receipt, discovery card, header, or left rail without losing the active conversation.
7. User can confirm, dismiss, or reject the surfaced clue. The drawer gives immediate feedback.
8. User can also mark each memory card as `对` or `不对`; the card status changes in place.
9. Closing the drawer returns to the same chat state and composer position.
