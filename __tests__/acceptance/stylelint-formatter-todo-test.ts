import '@microsoft/jest-sarif';
import stripAnsi from 'strip-ansi';
import {
  getTodoConfig,
  readTodoData,
  todoStorageFileExists,
  writeTodos,
} from '@lint-todo/utils';
import { createBinTester } from '@scalvert/bin-tester';
import { FakeProject } from '../__utils__/fake-project';
import { getObjectFixture, getStringFixture } from '../__utils__/get-fixture';
import { buildReadOptions } from '../__utils__/build-read-options';
import { buildMaybeTodos } from '../../src/formatter';

describe('stylelint with todo formatter', function () {
  let project: FakeProject;

  const { runBin, setupProject, teardownProject } = createBinTester({
    binPath: './node_modules/.bin/stylelint',
    staticArgs: [
      '--config',
      './stylelint-config.json',
      '--custom-formatter',
      require.resolve('../..'),
      // test all files under src/ folder
      'src/',
    ],
    createProject: async () => FakeProject.getInstance(),
  });

  beforeEach(async () => {
    project = await setupProject();
  });

  afterEach(() => {
    teardownProject();
  });

  it('errors if todo config exists in both package.json and .lint-todorc.js', async function () {
    await project.write({
      src: {
        'no-problems.css': getStringFixture('with-no-problems.css'),
      },
    });

    await project.setShorthandPackageJsonTodoConfig({
      warn: 5,
      error: 10,
    });

    await project.setLintTodorc({
      warn: 5,
      error: 10,
    });

    const result = await runBin();

    expect(result.exitCode).toBeGreaterThan(0);
    expect(result.stderr).toMatch(
      /You cannot have todo configurations in both package.json and .lint-todorc.js. Please move the configuration from the package.json to the .lint-todorc.js/
    );
  });

  it('should not emit anything when there are no errors or warnings', async () => {
    await project.write({
      src: {
        'no-problems.css': getStringFixture('with-no-problems.css'),
      },
    });

    const result = await runBin();

    expect(result.stdout).toEqual('');
    expect(result.exitCode).toEqual(0);
  });

  it('errors if using either TODO_DAYS_TO_WARN or TODO_DAYS_TO_ERROR without UPDATE_TODO', async () => {
    await project.write({
      src: {
        'no-problems.css': getStringFixture('with-no-problems.css'),
      },
    });

    let result = await runBin({
      env: { TODO_DAYS_TO_WARN: '10' },
    });

    expect(result.stderr).toContain(
      'Using `TODO_DAYS_TO_WARN` or `TODO_DAYS_TO_ERROR` is only valid when the `UPDATE_TODO` environment variable is being used.'
    );
    expect(result.exitCode).toBeGreaterThan(0);

    result = await runBin({
      env: { TODO_DAYS_TO_ERROR: '10' },
    });

    expect(result.stderr).toContain(
      'Using `TODO_DAYS_TO_WARN` or `TODO_DAYS_TO_ERROR` is only valid when the `UPDATE_TODO` environment variable is being used.'
    );
    expect(result.exitCode).toBeGreaterThan(0);
  });

  it('with UPDATE_TODO but no todos, outputs todos created summary', async function () {
    await project.write({
      src: {
        'no-problems.css': getStringFixture('with-no-problems.css'),
      },
    });

    const result = await runBin({
      env: {
        UPDATE_TODO: '1',
      },
    });

    expect(result.exitCode).toEqual(0);
    expect(result.stdout).toMatch(/✔ 0 todos created, 0 todos removed/);
  });

  it('with UPDATE_TODO, outputs todos created summary', async () => {
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
        'with-errors-1.css': getStringFixture('with-errors-1.css'),
      },
    });

    const result = await runBin({
      env: { UPDATE_TODO: '1' },
    });

    expect(result.exitCode).toEqual(0);
    expect(result.stdout).toMatch(/✔ 2 todos created, 0 todos removed/);
  });

  it('with UPDATE_TODO and INCLUDE_TODO, outputs todos created summary', async () => {
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
        'with-errors-1.css': getStringFixture('with-errors-1.css'),
      },
    });

    const result = await runBin({
      env: { UPDATE_TODO: '1', INCLUDE_TODO: '1' },
    });

    expect(result.exitCode).toEqual(0);
    expect(result.stdout).toMatch(
      /0 problems \(0 errors, 0 warnings, 2 todos\)/
    );

    expect(result.stdout).toMatch(/✔ 2 todos created, 0 todos removed/);
  });

  it('with UPDATE_TODO, outputs todos created summary with warn info', async () => {
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
        'with-errors-1.css': getStringFixture('with-errors-1.css'),
      },
    });

    const result = await runBin({
      env: { UPDATE_TODO: '1', TODO_DAYS_TO_WARN: '10' },
    });

    expect(result.exitCode).toEqual(0);
    expect(result.stdout).toMatch(
      /✔ 2 todos created, 0 todos removed \(warn after 10 days\)/
    );
  });

  it('with UPDATE_TODO, outputs todos created summary with error info', async () => {
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
        'with-errors-1.css': getStringFixture('with-errors-1.css'),
      },
    });

    const result = await runBin({
      env: { UPDATE_TODO: '1', TODO_DAYS_TO_ERROR: '10' },
    });

    expect(result.exitCode).toEqual(0);
    expect(result.stdout).toMatch(
      /✔ 2 todos created, 0 todos removed \(error after 10 days\)/
    );
  });

  it('with UPDATE_TODO, outputs todos created summary with warn and error info', async () => {
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
        'with-errors-1.css': getStringFixture('with-errors-1.css'),
      },
    });

    const result = await runBin({
      env: {
        UPDATE_TODO: '1',
        TODO_DAYS_TO_WARN: '5',
        TODO_DAYS_TO_ERROR: '10',
      },
    });

    expect(result.exitCode).toEqual(0);
    expect(result.stdout).toMatch(
      /✔ 2 todos created, 0 todos removed \(warn after 5, error after 10 days\)/
    );
  });

  it('should emit errors and warnings as normal', async () => {
    await project.write({
      src: {
        'with-errors-and-warnings.css': getStringFixture(
          'with-errors-and-warnings.css'
        ),
      },
    });

    const result = await runBin();
    const stdout = stripAnsi(result.stdout);

    expect(result.exitCode).toEqual(2);
    expect(stdout).toMatch(
      /2:3 {2}✖ {2}Unexpected unknown property "pdding" {2}property-no-unknown/
    );
    expect(stdout).toMatch(/4:3 {2}⚠ {2}Unexpected duplicate "color" {10}declaration-block-no-duplicate-properties/);
    expect(stdout).toMatch(
      /2 problems \(1 error, 1 warning\)/
    );
  });

  it('generates todos for existing errors', async function () {
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
      },
    });

    let result = await runBin({
      env: {
        UPDATE_TODO: '1',
      },
    });

    expect(result.exitCode).toEqual(0);
    expect(todoStorageFileExists(project.baseDir)).toEqual(true);
    expect(readTodoData(project.baseDir, buildReadOptions()).size).toEqual(1);

    result = await runBin();

    expect(result.exitCode).toEqual(0);
  });

  it('generates todos for existing errors, and correctly reports todo severity when file is edited to trigger fuzzy match', async function () {
    await project.write({
      src: {
        'with-errors.css': getStringFixture('with-errors-0.css'),
      },
    });

    let result = await runBin({
      env: {
        UPDATE_TODO: '1',
      },
    });

    expect(result.exitCode).toEqual(0);
    expect(todoStorageFileExists(project.baseDir)).toEqual(true);
    expect(readTodoData(project.baseDir, buildReadOptions()).size).toEqual(1);

    await project.write({
      src: {
        'with-errors.css': getStringFixture('with-errors-for-fuzzy.css'),
      },
    });

    result = await runBin();

    expect(result.exitCode).toEqual(0);
  });

  it('should not remove todos from another engine', async function () {
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
        'with-errors-1.css': getStringFixture('with-errors-1.css'),
      },
    });

    writeTodos(
      project.baseDir,
      buildMaybeTodos(
        project.baseDir,
        getObjectFixture(
          'different-engine-single-error.json',
          project.baseDir
        ),
        undefined,
        'ember-template-lint'
      ),
      {
        engine: 'stylelint',
        filePath: '',
        todoConfig: getTodoConfig(project.baseDir, 'stylelint'),
        shouldRemove: () => true,
      }
    );

    const result = await runBin({
      env: {
        UPDATE_TODO: '1',
      },
    });

    expect(result.exitCode).toEqual(0);
    expect(result.stdout).toMatch(
      /✔ 2 todos created, 0 todos removed \(warn after 30, error after 60 days\)/
    );
  });

  it('should emit todo items and count when UPDATE_TODO=1 and INCLUDE_TODO=1 are set', async () => {
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
        'with-errors-1.css': getStringFixture('with-errors-1.css'),
      },
    });

    const result = await runBin({
      env: { UPDATE_TODO: '1', INCLUDE_TODO: '1' },
    });
    const stdout = stripAnsi(result.stdout);

    expect(result.exitCode).toEqual(0);
    expect(stdout).toMatch(/src\/with-errors-0.css/);
    expect(stdout).toMatch(/2:10 {2}ℹ {2}Unexpected hex color "#0000ff" {2}color-no-hex/);
    expect(stdout).toMatch(/src\/with-errors-1.css/);
    expect(stdout).toMatch(/ℹ {2}Unexpected unknown property "colr" {2}property-no-unknown/);
    expect(stdout).toMatch(/0 problems \(0 errors, 0 warnings, 2 todos\)/);
    expect(stdout).toMatch(/✔ 2 todos created, 0 todos removed \(warn after 30, error after 60 days\)/);
  });

  it('should emit todo items and count when INCLUDE_TODO=1 is set alone with prior todo items', async () => {
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
        'with-errors-1.css': getStringFixture('with-errors-1.css'),
      },
    });

    // run stylelint to generate todo dir but don't capture the result because this is not what we're testing
    await runBin({
      env: { UPDATE_TODO: '1' },
    });

    // run with INCLUDE_TODO (this is what we're testing)
    const result = await runBin({
      env: { INCLUDE_TODO: '1' },
    });

    const stdout = stripAnsi(result.stdout);

    expect(result.exitCode).toEqual(0);
    expect(stdout).toMatch(/src\/with-errors-0.css/);
    expect(stdout).toMatch(/2:10 {2}ℹ {2}Unexpected hex color "#0000ff" {2}color-no-hex/);
    expect(stdout).toMatch(/src\/with-errors-1.css/);
    expect(stdout).toMatch(/ℹ {2}Unexpected unknown property "colr" {2}property-no-unknown/);
    expect(stdout).toMatch(/0 problems \(0 errors, 0 warnings, 2 todos\)/);
  });
});