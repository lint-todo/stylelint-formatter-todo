import type { TodoConfig, WriteTodoOptions } from '@lint-todo/utils';
import stylelint from 'stylelint';

export declare enum Severity {
  TODO = 'todo',
  OFF = 'off',
  WARNING = 'warning',
  ERROR = 'error'
}

export type LintResultWithTodo = Omit<stylelint.LintResult, 'warnings'> & {
  warnings: TodoWarning[]
}

export type TodoWarning = Omit<stylelint.Warning, 'severity'> & {
  severity:  'todo'| 'off' | 'warning' | 'error';
}

export type TodoInfo =
  | {
      added: number;
      removed: number;
      todoConfig: TodoConfig | undefined;
    }
  | undefined;

export interface TodoFormatterOptions {
  formatTodoAs: string | undefined;
  updateTodo: boolean;
  includeTodo: boolean;
  shouldCleanTodos: boolean;
  todoInfo: TodoInfo;
  writeTodoOptions: WriteTodoOptions;
}

export interface TodoFormatterCounts {
  readonly total: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly todoCount: number;
  readonly fixableErrorCount: number;
  readonly fixableWarningCount: number;
  readonly fixableTodoCount: number;
}
