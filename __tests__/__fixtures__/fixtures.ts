import { deepCopy } from '../__utils__/deep-copy';
import { updatePaths } from '../__utils__/update-paths';
import * as stylelintWithErrorsWarningsTodos from './stylelint-with-errors-warnings-todos.json';
import * as stylelintWithErrors from './stylelint-with-errors.json';
import * as stylelintWithTodos from './stylelint-with-todos.json';
import {
  LintResultWithTodo,
  LinterResultWithTodo,
} from '../../src/types';

const fixtures = {
  stylelintWithErrors: <LintResultWithTodo[]>(
    (<LinterResultWithTodo>(stylelintWithErrors as unknown)).results
  ),
  stylelintWithTodos: <LintResultWithTodo[]>(
    (<LinterResultWithTodo>(stylelintWithTodos as unknown)).results
  ),
  stylelintWithErrorsWarningsTodos: <LintResultWithTodo[]>(
    (<LinterResultWithTodo>(stylelintWithErrorsWarningsTodos as unknown)).results
  ),
};

export default {
  stylelintWithErrors(tmp: string): LintResultWithTodo[] {
    return updatePaths(tmp, deepCopy(fixtures.stylelintWithErrors));
  },
  stylelintWithTodos(tmp: string): LintResultWithTodo[] {
    return updatePaths(tmp, deepCopy(fixtures.stylelintWithTodos));
  },
  stylelintWithErrorsWarningsTodos(tmp: string): LintResultWithTodo[] {
    return updatePaths(tmp, deepCopy(fixtures.stylelintWithErrorsWarningsTodos));
  },
};
