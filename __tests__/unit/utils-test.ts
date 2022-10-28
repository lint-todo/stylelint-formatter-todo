import { getBaseDir } from '../../src/get-base-dir';

describe('utils', () => {
  const INITIAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...INITIAL_ENV };
  });

  afterAll(() => {
    process.env = INITIAL_ENV;
  });

  it('returns the path passed as ENV variable', () => {
    const stylelintTodoDir = 'stylelint-todo-dir';
    process.env.STYLELINT_TODO_DIR = stylelintTodoDir;
    expect(getBaseDir()).toEqual(stylelintTodoDir);
  });

  it('returns current working dir if no ENV variable was passed', () => {
    expect(getBaseDir()).toEqual(process.cwd());
  });
});
