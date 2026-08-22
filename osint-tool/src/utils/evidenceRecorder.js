function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function evidenceKey(entityType, entityId) {
  return `${entityType}:${Number(entityId)}`;
}

function backfillEvidence(db, personId) {
  if (!db || typeof db.addEvidence !== 'function' || typeof db.getEvidence !== 'function') return 0;

  const existing = new Set(
    db.getEvidence(personId)
      .filter((row) => row.entity_id !== null && row.entity_id !== undefined)
      .map((row) => evidenceKey(row.entity_type, row.entity_id))
  );

  let added = 0;

  if (typeof db.getSocialAccounts === 'function') {
    for (const account of db.getSocialAccounts(personId)) {
      const key = evidenceKey('social_account', account.id);
      if (existing.has(key)) continue;

      const metadata = safeJson(account.additional_data, {});
      const sourceName = metadata.source || account.platform;
      const sourceType = metadata.sourceKind || 'public_source';
      const evidenceType = sourceType === 'official_public_api'
        ? 'exact_username_api_record'
        : sourceType === 'external_username_engine'
          ? 'username_engine_claimed_record'
          : 'public_page_observation';

      db.addEvidence(personId, {
        sourceName,
        sourceType,
        entityType: 'social_account',
        entityId: account.id,
        evidenceType,
        sourceUrl: account.profile_url || null,
        status: 'observed',
        qualityScore: Number(account.confidence_score) || Number(metadata.evidenceQuality) || 0,
        observedAt: metadata.checkedAt || account.created_at || null,
        metadata
      });
      existing.add(key);
      added++;
    }
  }

  if (typeof db.getDomains === 'function') {
    for (const domain of db.getDomains(personId)) {
      const key = evidenceKey('domain', domain.id);
      if (existing.has(key)) continue;

      const metadata = safeJson(domain.additional_data, {});
      const sourceStatus = metadata.sourceStatus || {};
      const successfulSources = Object.entries(sourceStatus)
        .filter(([, status]) => status === 'ok')
        .map(([name]) => name);
      const qualityScore = successfulSources.length >= 2 ? 95 : successfulSources.length === 1 ? 85 : 70;

      db.addEvidence(personId, {
        sourceName: metadata.source || 'Live domain intelligence',
        sourceType: 'network_lookup',
        entityType: 'domain',
        entityId: domain.id,
        evidenceType: 'domain_infrastructure_observation',
        sourceUrl: domain.domain_name ? `https://rdap.org/domain/${encodeURIComponent(domain.domain_name)}` : null,
        status: 'observed',
        qualityScore,
        observedAt: metadata.checkedAt || domain.created_at || null,
        metadata: {
          ...metadata,
          successfulSources,
          caveat: 'The domain is derived from the case email address; this does not establish domain ownership by the email user.'
        }
      });
      existing.add(key);
      added++;
    }
  }

  return added;
}

module.exports = {
  backfillEvidence,
  safeJson
};
