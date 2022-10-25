import path from 'path';
import stringWidth from 'string-width';
import * as table from 'table';
import { yellow, dim, underline, red, green, cyan } from 'picocolors';
import stylelint from 'stylelint';
import { terminalLink } from './terminal-link';
import {
  ColumnWidths,
  LintResultWithTodo,
  Severity,
  TodoWarning,
  TodoPrintOptions,
  TodoInfo,
} from './types';
import sarifFormatter from 'stylelint-sarif-formatter';

const MARGIN_WIDTHS = 9;

const levelColors = {
  warning: yellow,
  error: red,
  off: green,
  todo: cyan,
};

const symbols = {
  warning: yellow('⚠'),
  error: red('✖'),
  off: green('⏾'),
  todo: cyan('ℹ'),
};

export default function printResults(
  results: LintResultWithTodo[],
  options: TodoPrintOptions = {},
  returnValue?: stylelint.LinterResult
): string {
  let output = invalidOptionsFormatter(results);

  if (options.formatTodoAs) {
    return sarifFormatter(results);
  }

  output += deprecationsFormatter(results);

  let errorCount = 0;
  let warningCount = 0;
  let todoCount = 0;

  output = results.reduce((accum, result) => {
    // Treat parseErrors as warnings
    if (result.parseErrors) {
      for (const error of result.parseErrors) {
        result.warnings.push({
          line: error.line,
          column: error.column,
          rule: error.stylelintType,
          severity: Severity.ERROR,
          text: `${error.text} (${error.stylelintType})`,
        });
        errorCount += 1;
      }
    }

    for (const warning of result.warnings) {
      switch (warning.severity) {
        case Severity.ERROR:
          errorCount += 1;
          break;
        case Severity.WARNING:
          warningCount += 1;
          break;
        case Severity.TODO:
          if (options.includeTodo) {
            todoCount += 1;
          }
          break;
        default:
          throw new Error(`Unknown severity: "${warning.severity}"`);
      }
    }

    const nonTodoWarnings = result.warnings.filter((warning) => warning.severity !== Severity.TODO);

    accum += options.includeTodo ? formatter(
        result.warnings,
        result.source ?? '',
        (returnValue && returnValue.cwd) || process.cwd()
      ) : formatter(
        nonTodoWarnings,
        result.source ?? '',
        (returnValue && returnValue.cwd) || process.cwd()
      );

    return accum;
  }, output);

  // Ensure consistent padding
  output = output.trim();

  if (output !== '') {
    output = `\n${output}\n\n`;

    // Problems are defined as warnings and errors
    const problemTotal = errorCount + warningCount;
    const total = problemTotal + todoCount;
    
    if (total > 0) {
      let tally = '';

      tally = options.includeTodo ? `${problemTotal} ${pluralize('problem', problemTotal)}` +
        ` (${errorCount} ${pluralize('error', errorCount)}` +
        `, ${warningCount} ${pluralize('warning', warningCount)}` + 
        `, ${todoCount} ${pluralize('todo', todoCount)})` : `${problemTotal} ${pluralize('problem', problemTotal)}` +
        ` (${errorCount} ${pluralize('error', errorCount)}` +
        `, ${warningCount} ${pluralize('warning', warningCount)})`;

      output += `${tally}\n\n`;
    }
  }

  if (options.updateTodo && options.todoInfo) {
    output += formatTodoSummary(options.todoInfo);
  }
  return output;
}

function formatTodoSummary(todoInfo: TodoInfo) {
  if (!todoInfo) {
    return '';
  }

  let todoSummary = `✔ ${todoInfo.added} todos created`;

  if (Number.isInteger(todoInfo.removed)) {
    todoSummary += `, ${todoInfo.removed} todos removed`;
  }

  if (todoInfo.todoConfig && todoInfo.todoConfig.daysToDecay) {
    const daysToDecay = todoInfo.todoConfig.daysToDecay;
    const todoConfigSummary = [];

    if (daysToDecay.warn) {
      todoConfigSummary.push(`warn after ${daysToDecay.warn}`);
    }

    if (daysToDecay.error) {
      todoConfigSummary.push(`error after ${daysToDecay.error}`);
    }

    if (todoConfigSummary.length > 0) {
      todoSummary += ` (${todoConfigSummary.join(', ')} days)`;
    }
  }

  return todoSummary;
}

function deprecationsFormatter(results: LintResultWithTodo[]): string {
  const allDeprecationWarnings = results.flatMap(
    (result) => result.deprecations
  );

  if (allDeprecationWarnings.length === 0) {
    return '';
  }

  const seenText = new Set();

  return allDeprecationWarnings.reduce((output, warning) => {
    if (seenText.has(warning.text)) return output;

    seenText.add(warning.text);

    output += yellow('Deprecation Warning: ');
    output += warning.text;

    if (warning.reference) {
      output += dim(' See: ');
      output += dim(underline(warning.reference));
    }

    return `${output}\n`;
  }, '\n');
}

function invalidOptionsFormatter(results: LintResultWithTodo[]): string {
  const allInvalidOptionWarnings = results.flatMap((result) =>
    result.invalidOptionWarnings.map((warning) => warning.text)
  );
  const uniqueInvalidOptionWarnings = [...new Set(allInvalidOptionWarnings)];

  return uniqueInvalidOptionWarnings.reduce((output, warning) => {
    output += red('Invalid Option: ');
    output += warning;

    return `${output}\n`;
  }, '\n');
}

function logFrom(fromValue: string, cwd: string): string {
  if (fromValue.startsWith('<')) {
    return underline(fromValue);
  }

  const filePath = path.relative(cwd, fromValue).split(path.sep).join('/');

  return terminalLink(filePath, `file://${fromValue}`);
}

function getMessageWidth(columnWidths: ColumnWidths) {
  const width = columnWidths[3];

  if (!process.stdout.isTTY) {
    return width;
  }

  const availableWidth =
    process.stdout.columns < 80 ? 80 : process.stdout.columns;
  const fullWidth = Object.values(columnWidths).reduce((a, b) => a + b);

  // If there is no reason to wrap the text, we won't align the last column to the right
  if (availableWidth > fullWidth + MARGIN_WIDTHS) {
    return width;
  }

  return availableWidth - (fullWidth - width + MARGIN_WIDTHS);
}

function formatter(
  messages: TodoWarning[],
  source: string,
  cwd: string
): string {
  if (messages.length === 0) return '';

  const orderedMessages = [...messages].sort((a, b) => {
    // positionless first
    if (!a.line && b.line) return -1;

    // positionless first
    if (a.line && !b.line) return 1;

    if (a.line < b.line) return -1;

    if (a.line > b.line) return 1;

    if (a.column < b.column) return -1;

    if (a.column > b.column) return 1;

    return 0;
  });

  /**
   * Create a list of column widths, needed to calculate
   * the size of the message column and if needed wrap it.
   */
  const columnWidths: ColumnWidths = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 };

  function calculateWidths(columns: string[]) {
    // return columns.map(value => {
    //   const normalisedValue = value ? value.toString() : value;
    // });
    for (const [key, value] of Object.entries(columns)) {
      const normalisedValue = value ? value.toString() : value;
      const index = Number.parseInt(key);
      const width = columnWidths[index];

      columnWidths[index] = Math.max(width, stringWidth(normalisedValue));
    }

    return columns;
  }

  let output = '\n';

  if (source) {
    output += `${logFrom(source, cwd)}\n`;
  }

  function formatMessageText(message: TodoWarning) {
    let result = message.text;

    result = result
      // Remove all control characters (newline, tab and etc)
      .replace(/[\u0001-\u001A]+/g, ' ') // eslint-disable-line no-control-regex
      .replace(/\.$/, '');

    const ruleString = ` (${message.rule})`;

    if (result.endsWith(ruleString)) {
      result = result.slice(0, result.lastIndexOf(ruleString));
    }

    return result;
  }

  const cleanedMessages = orderedMessages.map((message) => {
    const { line, column, severity, rule } = message;

    const row: string[] = [
      line ? line.toString() : '',
      column ? column.toString() : '',
      symbols[severity] ? levelColors[severity](symbols[severity]) : severity,
      formatMessageText(message),
      dim(rule || ''),
    ];

    calculateWidths(row);

    return row;
  });

  output += table
    .table(cleanedMessages, {
      border: table.getBorderCharacters('void'),
      columns: {
        0: { alignment: 'right', width: columnWidths[0], paddingRight: 0 },
        1: { alignment: 'left', width: columnWidths[1] },
        2: { alignment: 'center', width: columnWidths[2] },
        3: {
          alignment: 'left',
          width: getMessageWidth(columnWidths),
          wrapWord: getMessageWidth(columnWidths) > 1,
        },
        4: { alignment: 'left', width: columnWidths[4], paddingRight: 0 },
      },
      drawHorizontalLine: () => false,
    })
    .split('\n')
    .map(
      /**
       * @param {string} el
       * @returns {string}
       */
      (el) => el.replace(/(\d+)\s+(\d+)/, (_m, p1, p2) => dim(`${p1}:${p2}`))
    )
    .join('\n');

  return output;
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}
