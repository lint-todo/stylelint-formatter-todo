import {
  readTodoData,
  todoStorageFileExists,
} from '@lint-todo/utils';
import { DirResult, dirSync } from 'tmp';
import { buildMaybeTodos, formatter, updateResults, updateErroredState } from '../../src/formatter';
import fixtures from '../__fixtures__/fixtures';
import { buildReadOptions } from '../__utils__/build-read-options';
import { deepCopy } from '../__utils__/deep-copy';
import { setUpdateTodoEnv } from '../__utils__/set-env';
import { Severity } from '../../src/types';
import { LinterResult } from 'stylelint';

describe('format-results', () => {
  const INITIAL_ENV = process.env;

  let tmpDir: DirResult;
  const returnValue = {} as LinterResult;

  beforeEach(() => {
    tmpDir = dirSync({ unsafeCleanup: true });
    process.stdout.write = jest.fn();
    process.env = { ...INITIAL_ENV, ESLINT_TODO_DIR: tmpDir.name };
  });

  afterEach(() => {
    tmpDir.removeCallback();
    process.env = INITIAL_ENV;
  });

  it('SHOULD NOT generate a TODO dir with todo files when UPDATE_TODO is set to 0', () => {
    setUpdateTodoEnv(false);

    const results = fixtures.stylelintWithErrors(tmpDir.name);

    formatter(results, returnValue);

    expect(todoStorageFileExists(tmpDir.name)).toBe(false);
  });

  it('SHOULD generate a TODO dir with todo files when UPDATE_TODO is set to 1', () => {
    setUpdateTodoEnv(true);

    const results = fixtures.stylelintWithErrors(tmpDir.name);

    formatter(results, returnValue);

    expect(todoStorageFileExists(tmpDir.name)).toBe(true);

    const todos = readTodoData(tmpDir.name, buildReadOptions());

    const warningsTotal = results.reduce((size, result) => {
      return size + result.warnings.length
    }, 0);

    // All warnings generate todos
    expect(todos.size).toEqual(warningsTotal);
  });

  it('SHOULD not mutate errors if a todo dir is not present', () => {
    setUpdateTodoEnv(false);

    const results = fixtures.stylelintWithErrors(tmpDir.name);
    const expected = deepCopy(results);

    formatter(results, returnValue);

    expect(results).toEqual(expected);
  });

  it('SHOULD mutate errors when a todo dir is present', () => {
    setUpdateTodoEnv(true);

    const results = fixtures.stylelintWithErrors(tmpDir.name);
    const notExpected = deepCopy(results);

    formatter(results, returnValue);

    expect(results).not.toEqual(notExpected);
  });

  it('changes only the errors that are also present in the todo map to todos', () => {
    const results = fixtures.stylelintWithErrors(tmpDir.name);

    // build todo map but without the last result in the results array (so they differ)
    const todoResults = [...results];
    const lastResult = todoResults.pop();
    const todos = buildMaybeTodos(tmpDir.name, todoResults);

    updateResults(results, todos);

    // last result should stay unchanged
    expect(results[results.length - 1]).toEqual(lastResult);

    // everything else should be mutated
    results.forEach((result, resultIndex) => {
      if (resultIndex === results.length - 1) {
        return;
      }
      
      result.warnings.forEach((warning) => {
        expect(warning.severity).toEqual(Severity.TODO);
      });
    });
  });

  it('changes updates the errored state if all errors are present in the todo map', () => {
    const results = fixtures.stylelintWithErrors(tmpDir.name);

    // build todo map but without the last result in the results array (so they differ)
    const todoResults = [...results];
    const todos = buildMaybeTodos(tmpDir.name, todoResults);

    updateResults(results, todos);
    updateErroredState(results, {} as LinterResult);

    results.forEach((result) => {
      expect(result.errored).toEqual(false);
      
      result.warnings.forEach((warning) => {
        expect(warning.severity).toEqual(Severity.TODO);
      });
    });
  });
});
