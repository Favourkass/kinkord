# Country-based free chat allowance

Free members in Nigeria can't start new chats: messaging someone new is part of Silver (Premium) there, though they can always reply when someone messages them first. Free members in other countries may start three per Lagos calendar day. The saved sender profile country determines the allowance; an older account with no saved country is treated as Nigerian, consistently with the existing country-reach rule. The API enforces the cap under the existing first-message transaction lock and reports the same limit to the composer.

Silver's existing paid allowance and the founders' exemptions are unchanged. Replies and ongoing conversations do not consume new-chat allowance. Starting a cross-country conversation remains Premium-only; the existing reply exception stays intact.

When a free member can't start a chat (straight away in Nigeria, after three elsewhere), or at the existing cross-country gate, the app shows “🔒 Messaging Is a Premium Feature”, the requested explanation, and an **Upgrade to Premium** button below it. A paid member at their existing daily cap sees the reset notice instead of another upsell.
