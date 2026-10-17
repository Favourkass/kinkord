# Country-based free chat allowance

Free members in Nigeria have zero free new chats per day and must subscribe to start a new chat. Free members in other countries may start three. The saved sender profile country determines the allowance; an older account with no saved country is treated as Nigerian, consistently with the existing country-reach rule. The API enforces the cap under the existing first-message transaction lock and reports the same limit to the composer.

Silver's existing paid allowance and the founders' exemptions are unchanged. Replies and ongoing conversations do not consume new-chat allowance. Starting a cross-country conversation remains Premium-only; the existing reply exception stays intact.

At the free limit, or at the existing cross-country gate, the app shows “🔒 Messaging Is a Premium Feature”, the requested explanation, and an **Upgrade to Premium** button below it. A paid member at their existing daily cap sees the reset notice instead of another upsell.

The local image incident was a stopped MinIO service on port 19000. Its existing persisted files were retained; restarting it restored profile, cover, feed and chat images. No production media or messaging data was changed.
