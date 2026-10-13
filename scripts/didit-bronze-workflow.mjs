/**
 * Kinkord's identity verification workflow ("Bronze") as Didit's workflow API
 * takes it: ID document, active liveness with face search, face match to the
 * ID, and for Nigerian IDs a check against the document's government record. Kept apart from provision-didit-bronze-workflow.mjs
 * so it can be tested without calling Didit.
 */
export function bronzeWorkflowPayload(environment) {
  return {
    workflow_label:
      environment === "live" ? "Kinkord Bronze - Nigeria Live" : "Kinkord Bronze - Nigeria Test",
    status: "published",
    is_default: false,
    // Phone cameras only: a desktop webcam is easier to feed a fake video.
    // Didit offers desktop visitors a QR code to carry on on their phone.
    is_desktop_allowed: false,
    session_expiration_time: 86400,
    features: [
      {
        feature: "OCR",
        config: {
          is_age_restrictions_enabled: true,
          minimum_age: 18,
          minimum_age_action: "DECLINE",
          // Didit still raises its POSSIBLE_DUPLICATED_USER warning; Kinkord's
          // API sends those to Kinkord's own admin review (2FA, reasons, audit
          // log) rather than leaving them in Didit's console.
          duplicated_user_action: "NO_ACTION",
        },
      },
      {
        feature: "LIVENESS",
        config: {
          face_liveness_method: "ACTIVE_3D",
          // Face search compares the selfie with Kinkord's own verified members
          // (disclosed in the privacy notice). Its matches are raised as
          // warnings that Kinkord's API sends to Kinkord's admin review, so
          // none of them wait in Didit's console.
          face_search_enabled: true,
          face_liveness_duplicated_face_name_mismatch_action: "NO_ACTION",
          face_liveness_duplicated_face_document_mismatch_action: "NO_ACTION",
        },
      },
      { feature: "FACE_MATCH" },
      {
        feature: "DATABASE_VALIDATION",
        config: {
          database_validation_countries: {
            // Each Nigerian document against its own register: NIN for national
            // IDs, the passport register, the driver's licence register.
            NGA: { services: ["nga_national_id", "nga_passport", "nga_drivers_license"] },
          },
          // Kinkord accepts a partial match once Didit's reviewer has approved
          // it, so these wait in Didit's console for a person.
          database_validation_partial_match_action: "REVIEW",
          database_validation_no_match_action: "DECLINE",
          // Other countries' IDs have no Nigerian record to check. Kinkord's
          // backend still requires a record match for any Nigerian-issued ID.
          database_validation_not_applicable_action: "NO_ACTION",
        },
      },
    ],
  };
}

/**
 * How a workflow Didit holds differs from the payload: each feature it lacks
 * and each feature setting it holds with another value. Empty when it matches.
 */
export function workflowDifferences(payload, workflow) {
  const nodes = Object.values(workflow?.workflow_graph?.nodes ?? {}).filter(
    (node) => node?.node_type === "feature",
  );
  return payload.features.flatMap(({ feature, config }) => {
    const node = nodes.find((item) => item.feature === feature);
    if (!node) return [`${feature} is missing`];
    return config ? differences(config, node.config, feature) : [];
  });
}

/** Each setting in `expected` that `actual` doesn't hold; a list must hold every expected item. */
function differences(expected, actual, path) {
  if (expected && typeof expected === "object" && !Array.isArray(expected))
    return Object.entries(expected).flatMap(([key, value]) =>
      differences(value, actual?.[key], `${path}.${key}`),
    );
  const same = Array.isArray(expected)
    ? Array.isArray(actual) && expected.every((item) => actual.includes(item))
    : expected === actual;
  return same
    ? []
    : [`${path} is ${JSON.stringify(actual) ?? "not set"}, not ${JSON.stringify(expected)}`];
}
