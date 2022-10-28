export function getBaseDir(): string {
  return process.env.STYLELINT_TODO_DIR || process.cwd();
}
