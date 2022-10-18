import { ReadTodoOptions } from '@lint-todo/utils';

export function buildReadOptions(): ReadTodoOptions {
  return { engine: 'stylelint', filePath: '' };
}
