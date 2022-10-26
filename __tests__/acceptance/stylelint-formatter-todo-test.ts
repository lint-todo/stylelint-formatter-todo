import '@microsoft/jest-sarif';
import stripAnsi from 'strip-ansi';
import { differenceInDays, subDays } from 'date-fns';
import {
  DaysToDecay,
  DaysToDecayByRule,
  getTodoConfig,
  getTodoStorageFilePath,
  readTodoData,
  readTodoStorageFile,
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

  it('should emit errors, warnings, and todos when all of these are present and INCLUDE_TODO=1 is set', async () => {
    // first we generate project files with errors and convert them to todos
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
      },
    });

    await runBin({
      env: { UPDATE_TODO: '1' },
    });

    // now we add new errors and warnings to test output with all problems
    await project.write({
      src: {
        'with-errors-and-warnings.css': getStringFixture(
          'with-errors-and-warnings.css'
        ),
      },
    });

    const result = await runBin({
      env: { INCLUDE_TODO: '1' },
    });

    const stdout = stripAnsi(result.stdout);

    expect(result.exitCode).toEqual(2);
    expect(stdout).toMatch(/src\/with-errors-0.css/);
    expect(stdout).toMatch(/2:10 {2}ℹ {2}Unexpected hex color "#0000ff" {2}color-no-hex/);
    expect(stdout).toMatch(/src\/with-errors-and-warnings.css/);
    expect(stdout).toMatch(/2:3 {2}✖ {2}Unexpected unknown property "pdding" {2}property-no-unknown/);
    expect(stdout).toMatch(/4:3 {2}⚠ {2}Unexpected duplicate "color" {10}declaration-block-no-duplicate-properties/);
    expect(stdout).toMatch(/2 problems \(1 error, 1 warning, 1 todo\)/);
  });

  it('errors if a todo item is no longer valid when running without params, and fixes with --fix', async function () {
    await project.write({
      src: {
        'with-fixable-error.css': getStringFixture('with-fixable-error.css'),
      },
    });

    // generate todo based on existing error
    await runBin({
      env: { UPDATE_TODO: '1' },
    });

    // mimic fixing the error manually via user interaction
    await project.write({
      src: {
        'with-fixable-error.css': getStringFixture('with-no-problems.css'),
      },
    });

    // run normally and expect an error for not running --fix
    let result = await runBin({
      env: { CI: '1' },
    });

    expect(result.exitCode).toEqual(2);
    const results = stripAnsi(result.stdout).trim().split(/\r?\n/);

    expect(results[1]).toMatch(
      /0:0 {2}✖ {2}Todo violation passes `CssSyntaxError` rule. Please run with `CLEAN_TODO=1` env var to remove this todo from the todo list {2}invalid-todo-violation-rule/
    );
    expect(results[3]).toMatch(/1 problem \(1 error, 0 warnings\)/);

    // run fix, and expect that this will delete the outstanding todo item
    await runBin('--fix');

    // run normally again and expect no error
    result = await runBin();

    const todoContents = readTodoStorageFile(
      getTodoStorageFilePath(project.baseDir)
    );

    expect(result.exitCode).toEqual(0);
    expect(stripAnsi(result.stdout).trim()).toEqual('');
    expect(todoContents).toHaveLength(2);
  });

  it('can compact todo storage file', async function () {
    await project.write({
      src: {
        'with-fixable-error.css': getStringFixture('with-fixable-error.css'),
      },
    });

    // generate todo based on existing error
    await runBin({
      env: {
        UPDATE_TODO: '1',
        TODO_CREATED_DATE: new Date('12/01/21').toJSON(),
      },
    });

    // mimic fixing the error manually via user interaction
    await project.write({
      src: {
        'with-fixable-error.css': getStringFixture('with-no-problems.css'),
      },
    });

    // normally we wouldn't need to use the --fix flag, since todos are auto-cleaned. Auto cleaning by default isn't
    // enabled in CI, however, so we need to force the fix in order to mimic the default behavior.
    const result = await runBin('--fix');

    expect(result.exitCode).toEqual(0);

    expect(readTodoStorageFile(getTodoStorageFilePath(project.baseDir)))
      .toMatchInlineSnapshot(`
      Array [
        "add|stylelint|CssSyntaxError|1|1|1|1|da39a3ee5e6b4b0d3255bfef95601890afd80709|1638316800000|1640908800000|1643500800000|src/with-fixable-error.css",
        "remove|stylelint|CssSyntaxError|1|1|1|1|da39a3ee5e6b4b0d3255bfef95601890afd80709|1638316800000|1640908800000|1643500800000|src/with-fixable-error.css",
      ]
    `);

    await runBin({
      env: {
        COMPACT_TODO: '1',
      },
    });

    expect(readTodoStorageFile(getTodoStorageFilePath(project.baseDir)))
      .toMatchInlineSnapshot(`
      Array [
        "add|stylelint|CssSyntaxError|1|1|1|1|da39a3ee5e6b4b0d3255bfef95601890afd80709|1638316800000|1640908800000|1643500800000|src/with-fixable-error.css",
      ]
    `);

    expect(result.exitCode).toEqual(0);
  });

  for (const { name, isLegacy, setTodoConfig } of [
    {
      name: 'Shorthand todo configuration',
      isLegacy: true,
      setTodoConfig: async (daysToDecay: DaysToDecay) =>
        await project.setShorthandPackageJsonTodoConfig(daysToDecay),
    },
    {
      name: 'Package.json todo configuration',
      isLegacy: false,
      setTodoConfig: async (
        daysToDecay: DaysToDecay,
        daysToDecayByRule?: DaysToDecayByRule
      ) =>
        await project.setPackageJsonTodoConfig(daysToDecay, daysToDecayByRule),
    },
    {
      name: '.lint-todorc.js todo configuration',
      isLegacy: false,
      setTodoConfig: async (
        daysToDecay: DaysToDecay,
        daysToDecayByRule?: DaysToDecayByRule
      ) => await project.setLintTodorc(daysToDecay, daysToDecayByRule),
    },
  ]) {
    // eslint-disable-next-line jest/valid-title
    describe(name, () => {
      it('should error if daysToDecay.error is less than daysToDecay.warn in config', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          warn: 10,
          error: 5,
        });

        const result = await runBin({
          env: { UPDATE_TODO: '1' },
        });

        expect(result.stderr).toMatch(
          'The provided todo configuration contains invalid values. The `warn` value (10) must be less than the `error` value (5).'
        );
      });

      it('should create todos with correct warn date set', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          warn: 10,
        });

        const result = await runBin({
          env: { UPDATE_TODO: '1' },
        });

        const todos = readTodoData(project.baseDir, buildReadOptions());

        expect(result.exitCode).toEqual(0);

        todos.forEach((todo) => {
          expect(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            differenceInDays(
              new Date(todo.warnDate!),
              new Date(todo.createdDate)
            )
          ).toEqual(10);
        });
      });

      it('should create todos with correct warn date set via env var (overrides config value)', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          warn: 10,
        });

        const result = await runBin({
          env: { UPDATE_TODO: '1', TODO_DAYS_TO_WARN: '30' },
        });

        const todos = readTodoData(project.baseDir, buildReadOptions());

        expect(result.exitCode).toEqual(0);

        todos.forEach((todo) => {
          expect(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            differenceInDays(
              new Date(todo.warnDate!),
              new Date(todo.createdDate)
            )
          ).toEqual(30);
        });
      });

      it('should create todos with correct error date set', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          error: 10,
        });

        const result = await runBin({
          env: { UPDATE_TODO: '1' },
        });

        const todos = readTodoData(project.baseDir, buildReadOptions());

        expect(result.exitCode).toEqual(0);

        todos.forEach((todo) => {
          expect(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            differenceInDays(
              new Date(todo.errorDate!),
              new Date(todo.createdDate)
            )
          ).toEqual(10);
        });
      });

      it('should create todos with correct error date set via env var (overrides config value)', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          error: 10,
        });

        const result = await runBin({
          env: { UPDATE_TODO: '1', TODO_DAYS_TO_ERROR: '30' },
        });

        const todos = readTodoData(project.baseDir, buildReadOptions());

        expect(result.exitCode).toEqual(0);

        todos.forEach((todo) => {
          expect(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            differenceInDays(
              new Date(todo.errorDate!),
              new Date(todo.createdDate)
            )
          ).toEqual(30);
        });
      });

      it('should create todos with correct dates set for warn and error', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          warn: 5,
          error: 10,
        });

        const result = await runBin({
          env: { UPDATE_TODO: '1' },
        });

        const todos = readTodoData(project.baseDir, buildReadOptions());

        expect(result.exitCode).toEqual(0);

        todos.forEach((todo) => {
          expect(
            differenceInDays(
              new Date(todo.warnDate!),
              new Date(todo.createdDate)
            )
          ).toEqual(5);
          expect(
            differenceInDays(
              new Date(todo.errorDate!),
              new Date(todo.createdDate)
            )
          ).toEqual(10);
        });
      });

      it('should create todos with correct dates set for warn and error via env var (overrides config value)', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          warn: 5,
          error: 10,
        });

        const result = await runBin({
          env: {
            UPDATE_TODO: '1',
            TODO_DAYS_TO_WARN: '10',
            TODO_DAYS_TO_ERROR: '20',
          },
        });

        const todos = readTodoData(project.baseDir, buildReadOptions());

        expect(result.exitCode).toEqual(0);

        todos.forEach((todo) => {
          expect(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            differenceInDays(
              new Date(todo.warnDate!),
              new Date(todo.createdDate)
            )
          ).toEqual(10);
          expect(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            differenceInDays(
              new Date(todo.errorDate!),
              new Date(todo.createdDate)
            )
          ).toEqual(20);
        });
      });

      it('should set to todo if warnDate is not expired', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          warn: 5,
        });

        await runBin({
          env: {
            UPDATE_TODO: '1',
          },
        });

        const result = await runBin({
          env: {
            INCLUDE_TODO: '1',
          },
        });
        const stdout = stripAnsi(result.stdout);

        expect(result.exitCode).toEqual(0);
        expect(stdout).toMatch(
          /src\/with-errors-0.css/
        );
        expect(stdout).toMatch(
          /2:10 {2}ℹ {2}Unexpected hex color "#0000ff" {2}color-no-hex/
        );
        expect(stdout).toMatch(
          /0 problems \(0 errors, 0 warnings, 1 todo\)/
        );
      });

      it('should set to todo if errorDate is not expired', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          error: 5,
        });

        await runBin({
          env: {
            UPDATE_TODO: '1',
          },
        });

        const result = await runBin({
          env: {
            INCLUDE_TODO: '1',
          },
        });
        const stdout = stripAnsi(result.stdout);

        expect(result.exitCode).toEqual(0);
        expect(stdout).toMatch(
          /src\/with-errors-0.css/
        );
        expect(stdout).toMatch(
          /2:10 {2}ℹ {2}Unexpected hex color "#0000ff" {2}color-no-hex/
        );
        expect(stdout).toMatch(
          /0 problems \(0 errors, 0 warnings, 1 todo\)/
        );
      });

      it('should set todo to warn if warnDate has expired via config', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          warn: 5,
        });

        await runBin({
          env: {
            UPDATE_TODO: '1',
            TODO_CREATED_DATE: subDays(new Date(), 10).toJSON(),
          },
        });

        const result = await runBin();
        const stdout = stripAnsi(result.stdout);

        expect(result.exitCode).toEqual(0);
        expect(stdout).toMatch(
          /src\/with-errors-0.css/
        );
        expect(stdout).toMatch(
          /2:10 {2}⚠ {2}Unexpected hex color "#0000ff" {2}color-no-hex/
        );
        expect(stdout).toMatch(
          /1 problem \(0 errors, 1 warning\)/
        );
      });

      it('should set todo to warn if warnDate has expired via env var', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await runBin({
          env: {
            UPDATE_TODO: '1',
            TODO_CREATED_DATE: subDays(new Date(), 10).toJSON(),
            TODO_DAYS_TO_WARN: '5',
          },
        });

        const result = await runBin();
        const stdout = stripAnsi(result.stdout);

        expect(result.exitCode).toEqual(0);
        expect(stdout).toMatch(
          /src\/with-errors-0.css/
        );
        expect(stdout).toMatch(
          /2:10 {2}⚠ {2}Unexpected hex color "#0000ff" {2}color-no-hex/
        );
        expect(stdout).toMatch(
          /1 problem \(0 errors, 1 warning\)/
        );
      });

      it('should set todo to warn if warnDate has expired but errorDate has not', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          warn: 5,
          error: 10,
        });

        await runBin({
          env: {
            UPDATE_TODO: '1',
            TODO_CREATED_DATE: subDays(new Date(), 7).toJSON(),
          },
        });

        const result = await runBin();
        const stdout = stripAnsi(result.stdout);

        expect(result.exitCode).toEqual(0);
        expect(stdout).toMatch(
          /src\/with-errors-0.css/
        );
        expect(stdout).toMatch(
          /2:10 {2}⚠ {2}Unexpected hex color "#0000ff" {2}color-no-hex/
        );
        expect(stdout).toMatch(
          /1 problem \(0 errors, 1 warning\)/
        );
      });

      it('should set todo to error if errorDate has expired via config', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          error: 5,
        });

        await runBin({
          env: {
            UPDATE_TODO: '1',
            TODO_CREATED_DATE: subDays(new Date(), 10).toJSON(),
          },
        });

        const result = await runBin();
        const stdout = stripAnsi(result.stdout);

        expect(result.exitCode).toEqual(2);
        expect(stdout).toMatch(
          /src\/with-errors-0.css/
        );
        expect(stdout).toMatch(
          /2:10 {2}✖ {2}Unexpected hex color "#0000ff" {2}color-no-hex/
        );
        expect(stdout).toMatch(
          /1 problem \(1 error, 0 warnings\)/
        );
      });

      it('should set todo to error if errorDate has expired via env var', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await runBin({
          env: {
            UPDATE_TODO: '1',
            TODO_CREATED_DATE: subDays(new Date(), 10).toJSON(),
            TODO_DAYS_TO_ERROR: '5',
          },
        });

        const result = await runBin();
        const stdout = stripAnsi(result.stdout);

        expect(result.exitCode).toEqual(2);
        expect(stdout).toMatch(
          /src\/with-errors-0.css/
        );
        expect(stdout).toMatch(
          /2:10 {2}✖ {2}Unexpected hex color "#0000ff" {2}color-no-hex/
        );
        expect(stdout).toMatch(
          /1 problem \(1 error, 0 warnings\)/
        );
      });

      it('should set todo to error if both warnDate and errorDate have expired via config', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await setTodoConfig({
          warn: 5,
          error: 10,
        });

        await runBin({
          env: {
            UPDATE_TODO: '1',
            TODO_CREATED_DATE: subDays(new Date(), 11).toJSON(),
          },
        });

        const result = await runBin();
        const stdout = stripAnsi(result.stdout);

        expect(result.exitCode).toEqual(2);
        expect(stdout).toMatch(
          /src\/with-errors-0.css/
        );
        expect(stdout).toMatch(
          /2:10 {2}✖ {2}Unexpected hex color "#0000ff" {2}color-no-hex/
        );
        expect(stdout).toMatch(
          /1 problem \(1 error, 0 warnings\)/
        );
      });

      it('should set todo to error if both warnDate and errorDate have expired via env vars', async function () {
        await project.write({
          src: {
            'with-errors-0.css': getStringFixture('with-errors-0.css'),
          },
        });

        await runBin({
          env: {
            UPDATE_TODO: '1',
            TODO_CREATED_DATE: subDays(new Date(), 11).toJSON(),
            TODO_DAYS_TO_WARN: '5',
            TODO_DAYS_TO_ERROR: '10',
          },
        });

        const result = await runBin();
        const stdout = stripAnsi(result.stdout);

        expect(result.exitCode).toEqual(2);
        expect(stdout).toMatch(
          /src\/with-errors-0.css/
        );
        expect(stdout).toMatch(
          /2:10 {2}✖ {2}Unexpected hex color "#0000ff" {2}color-no-hex/
        );
        expect(stdout).toMatch(
          /1 problem \(1 error, 0 warnings\)/
        );
      });

      if (!isLegacy) {
        it('should set todos to correct dates for specific rules', async () => {
          await project.write({
            src: {
              'with-errors-0.css': getStringFixture('with-errors-0.css'),
            },
          });

          await setTodoConfig(
            {
              warn: 5,
              error: 10,
            },
            {
              'color-no-hex': {
                warn: 10,
                error: 20,
              },
            }
          );

          const result = await runBin({
            env: {
              UPDATE_TODO: '1',
            },
          });

          const todos = readTodoData(project.baseDir, buildReadOptions());

          expect(result.exitCode).toEqual(0);

          for (const todo of todos) {
            expect(
              differenceInDays(
                new Date(todo.warnDate!),
                new Date(todo.createdDate)
              )
            ).toEqual(10);
            expect(
              differenceInDays(
                new Date(todo.errorDate!),
                new Date(todo.createdDate)
              )
            ).toEqual(20);
          }
        });
      }
    });
  }

  it('when given FORMAT_TODO_AS_SARIF will output with sarif format', async () => {
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
      },
    });

    const result = await runBin({
      env: {
        FORMAT_TODO_AS_SARIF: '1',
      },
    });

    expect(JSON.parse(result.stdout)).toBeValidSarifLog();
  });

  it('when given FORMAT_TODO_AS_SARIF will ensure that results provided do not include todos', async () => {
    await project.write({
      src: {
        'with-errors-0.css': getStringFixture('with-errors-0.css'),
      },
    });

    let result = await runBin();

    expect(result.stdout).toMatch(/1 problem \(1 error, 0 warnings\)/);

    result = await runBin({
      env: {
        UPDATE_TODO: '1',
      },
    });

    // we should have created todos for all of the errors
    expect(result.stdout).toMatch(
      '1 todos created, 0 todos removed (warn after 30, error after 60 days)'
    );

    result = await runBin({
      env: {
        FORMAT_TODO_AS_SARIF: '1',
      },
    });

    // extract errors from SARIF results, we should continue to have no errors (todos are respected with external formatter)
    const potentialErrors = JSON.parse(result.stdout).runs[0].results.reduce(
      (acc: string[], result: any) =>
        result.level === 'error' ? [...acc, result.message.text] : acc,
      []
    );

    expect(potentialErrors).toHaveLength(0);
  });
});