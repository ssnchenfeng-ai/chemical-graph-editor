import type { UnifiedIssue } from './validation';

export interface PublishValidation {
  errors: string[];
  warnings: string[];
}

export interface PublishDecision {
  blocked: boolean;
  needsConfirm: boolean;
  errorCount: number;
  warningCount: number;
}

export const decidePublishFromIssues = (issues: UnifiedIssue[]): PublishDecision => {
  const errorCount = issues.filter((issue) => issue.level === 'error').length;
  const warningCount = issues.filter((issue) => issue.level === 'warning').length;
  return {
    blocked: errorCount > 0,
    needsConfirm: errorCount === 0 && warningCount > 0,
    errorCount,
    warningCount,
  };
};

export const decidePublish = (input: PublishValidation): PublishDecision => {
  return decidePublishFromIssues([
    ...input.errors.map((message, index) => ({ level: 'error' as const, code: `ERR_${index + 1}`, message })),
    ...input.warnings.map((message, index) => ({ level: 'warning' as const, code: `WARN_${index + 1}`, message })),
  ]);
};
