import { FormatterType, LintResult } from 'stylelint';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import formatters from 'stylelint/lib/formatters';

type Formatter = (results: LintResult[]) => string;

export function getFormatter(formatterName: FormatterType | string): Formatter {
  let formatter;

  if (typeof formatterName === 'string') {
    formatter = Object.keys(formatters).includes(formatterName)
      ? formatters[formatterName]
      : require(require.resolve(formatterName));

    if (formatter === undefined) {
      throw new Error(
        `You must use a valid FORMAT_TODO_AS: ${formatterName} or a function`
      );
    }

    return formatter;
  }

  if (typeof formatterName === 'function') {
    return formatterName;
  }

  throw new Error(
    `You must use a valid FORMAT_TODO_AS: ${formatterName} or a function`
  );
}
