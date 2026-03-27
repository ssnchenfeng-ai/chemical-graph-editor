export type UnifiedIssueLevel = 'error' | 'warning';

export interface UnifiedIssue {
  level: UnifiedIssueLevel;
  code: string;
  message: string;
  entityId?: string;
  source?: 'editor' | 'ontology' | 'shape' | 'domain' | 'unknown';
}

export interface IssueBuckets {
  errors: string[];
  warnings: string[];
}

export const bucketsFromIssues = (issues: UnifiedIssue[]): IssueBuckets => ({
  errors: issues.filter((issue) => issue.level === 'error').map((issue) => issue.message),
  warnings: issues.filter((issue) => issue.level === 'warning').map((issue) => issue.message),
});

export const issuesFromBuckets = (
  buckets: IssueBuckets,
  source: UnifiedIssue['source'] = 'unknown',
): UnifiedIssue[] => {
  const errors = buckets.errors.map((message, index) => ({
    level: 'error' as const,
    code: `ERR_${String(index + 1).padStart(3, '0')}`,
    message,
    source,
  }));
  const warnings = buckets.warnings.map((message, index) => ({
    level: 'warning' as const,
    code: `WARN_${String(index + 1).padStart(3, '0')}`,
    message,
    source,
  }));
  return [...errors, ...warnings];
};
