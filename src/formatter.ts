import {
  applyTodoChanges,
  buildTodoDatum,
  compactTodoStorageFile,
  generateTodoBatches,
  getSeverity,
  getTodoConfig,
  Severity as SeverityIntegers,
  TodoConfig,
  TodoData,
  todoStorageFileExists,
  validateConfig,
  WriteTodoOptions,
  writeTodos
} from '@lint-todo/utils';
import ci from 'ci-info';
import hasFlag from 'has-flag';
import { join, relative } from 'path';
import { getBaseDir } from './get-base-dir';
import { LintResultWithTodo, Severity, TodoFormatterOptions, TodoWarning } from './types';
import printResults from './print-results';

const SEVERITY_INT_MAP = {
  [-1]: Severity.TODO,
  [0]: Severity.OFF,
  [1]: Severity.WARNING,
  [2]: Severity.ERROR
};

export async function formatter(results: LintResultWithTodo[]): Promise<string> {
  const baseDir = getBaseDir();
  const todoConfigResult = validateConfig(baseDir);

  if (!todoConfigResult.isValid) {
    throw new Error(todoConfigResult.message);
  }

  if (process.env.COMPACT_TODO) {
    const { compacted } = compactTodoStorageFile(baseDir);

    return `Removed ${compacted} todos in .lint-todo storage file`;
  }

  const todoInfo = {
    added: 0,
    removed: 0,
    todoConfig: getTodoConfig(process.cwd(), 'stylelint') ?? {},
  };

  const formatTodoAs = process.env.FORMAT_TODO_AS;
  const updateTodo = process.env.UPDATE_TODO === '1';
  const includeTodo = process.env.INCLUDE_TODO === '1';
  const cleanTodo = !process.env.NO_CLEAN_TODO && !ci.isCI;
  const shouldFix = hasFlag('fix');
  const shouldCleanTodos = shouldFix || cleanTodo;

  if (
    (process.env.TODO_DAYS_TO_WARN || process.env.TODO_DAYS_TO_ERROR) &&
    !updateTodo
  ) {
    throw new Error(
      'Using `TODO_DAYS_TO_WARN` or `TODO_DAYS_TO_ERROR` is only valid when the `UPDATE_TODO` environment variable is being used.'
    );
  }

  for (const fileResults of results) {
    const maybeTodos = buildMaybeTodos(
      baseDir,
      [fileResults],
      todoInfo.todoConfig
    );

    const optionsForFile: WriteTodoOptions = {
      engine: 'stylelint',
      shouldRemove: (todoDatum: TodoData) => todoDatum.engine === 'stylelint',
      todoConfig: todoInfo.todoConfig,
      filePath: relative(baseDir, fileResults.source ?? ''),
    };

    if (updateTodo) {
      const { addedCount, removedCount } = writeTodos(
        baseDir,
        maybeTodos,
        optionsForFile
      );

      todoInfo.added += addedCount;
      todoInfo.removed += removedCount;
    }

    processResults(results, maybeTodos, {
      formatTodoAs,
      updateTodo,
      includeTodo,
      shouldCleanTodos,
      todoInfo,
      writeTodoOptions: optionsForFile,
    });
  }

  return printResults(results, {
    formatTodoAs,
    updateTodo,
    includeTodo,
    shouldCleanTodos,
    todoInfo,
  });
}

function processResults(
  results: LintResultWithTodo[],
  maybeTodos: Set<TodoData>,
  options: TodoFormatterOptions
) {
  const baseDir = getBaseDir();

  if (todoStorageFileExists(baseDir)) {
    const { remove, stable, expired } = generateTodoBatches(
      baseDir,
      maybeTodos,
      options.writeTodoOptions
    );

    if (remove.size > 0 || expired.size > 0) {
      if (options.shouldCleanTodos) {
        applyTodoChanges(baseDir, new Set(), new Set([...remove, ...expired]));
      } else {
        for (const todo of remove) {
          pushResult(results, todo);
        }
      }
    }

    updateResults(results, stable);
  }
}

/**
 * Mutates all errors present in the todo dir to todos in the results array.
 *
 * @param results Stylelint results array
 */
 export function updateResults(
  results: LintResultWithTodo[],
  existingTodos: Set<TodoData>
): void {
  for (const todo of existingTodos) {
    const SeverityInteger: SeverityIntegers = getSeverity(todo);
    const severity: Severity = SEVERITY_INT_MAP[SeverityInteger];

    if (severity === Severity.ERROR) {
      continue;
    }

    const result = findResult(results, todo);

    if (!result) {
      continue;
    }

    const warning = result.warnings.find(
      (warning) => warning === todo.originalLintResult
    );

    if (!warning) {
      continue;
    }

    warning.severity = <Severity>severity;

    // The warning object does not have an error count for us to reference
    // In order to update the errored state without adding the error count field we need to do a search 
    result.errored = result.warnings.some(warning => warning.severity === Severity.ERROR);
  }
}

export function buildMaybeTodos(
  baseDir: string,
  lintResults: LintResultWithTodo[],
  todoConfig?: TodoConfig,
  engine?: string
): Set<TodoData> {
  const results = lintResults.filter((result) => result.warnings.length > 0);

  const todoData = results.reduce((converted, lintResult) => {
    lintResult.warnings.forEach((warning) => {
      if (warning.severity !== Severity.ERROR) {
        return;
      }

      const range = {
        start: {
          line: warning.line,
          column: warning.column,
        },
        end: {
          line: warning.endLine ?? warning.line,
          column: warning.endColumn ?? warning.column,
        },
      };
      
      const todoDatum = buildTodoDatum(
        baseDir,
        {
          engine: engine ?? 'stylelint',
          filePath: lintResult.source ?? '',
          ruleId: warning.rule ?? '',
          range,
					// Stylelint does not have source as a part of its warning
          source: '',
          originalLintResult: warning,
        },
        todoConfig
      );

      converted.add(todoDatum);
    });

    return converted;
  }, new Set<TodoData>());

  return todoData;
}

function pushResult(results: LintResultWithTodo[], todo: TodoData) {
  const resultForFile = findResult(results, todo);

  const todoWarning: TodoWarning = {
    rule: 'invalid-todo-violation-rule',
    text: `Todo violation passes \`${todo.ruleId}\` rule. Please run with \`CLEAN_TODO=1\` env var to remove this todo from the todo list.`,
    severity: 'todo',
    column: 0,
    line: 0,
  };

  if (resultForFile) {
    resultForFile.warnings.push(todoWarning);
  } else {
    results.push({
      source: join(getBaseDir(), todo.filePath),
      warnings: [todoWarning],
      deprecations: [],
      invalidOptionWarnings: [],
      parseErrors: []
    });
  }
}

function findResult(results: LintResultWithTodo[], todo: TodoData) {
  return results.find(
    (result) => relative(getBaseDir(), result.source ?? '') === todo.filePath
  );
}