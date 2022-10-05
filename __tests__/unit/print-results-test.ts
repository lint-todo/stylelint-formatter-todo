import { stripIndent } from 'common-tags';
import prepareFormatterOutput from '../__utils__/prepare-formatter-output';
import printResults from '../../src/print-results';
import {
	LintResultWithTodo,
} from '../../src/types';

function getOptions(options = {}) {
  return Object.assign(
    {},
    {
      formatTodoAs: undefined,
      updateTodo: false,
      includeTodo: false,
      shouldCleanTodos: true,
      todoInfo: undefined,
      writeTodoOptions: {},
    },
    options
  );
}

describe('printResults', () => {
	let actualTTY: boolean;
	let actualColumns: number;

	beforeAll(() => {
		actualTTY = process.stdout.isTTY;
		actualColumns = process.stdout.columns;
	});

	afterAll(() => {
		process.stdout.isTTY = actualTTY;
		process.stdout.columns = actualColumns;
	});

	it('outputs no warnings', () => {
		const results: LintResultWithTodo[] = [
			{
				source: 'path/to/file.css',
				errored: false,
				warnings: [],
				deprecations: [],
				invalidOptionWarnings: [],
        parseErrors: [],
			},
		];

		const output = printResults(results, getOptions());

		expect(output).toBe('');
	});

	it('outputs warnings', () => {
		const results: LintResultWithTodo[] = [
			{
				source: 'path/to/file.css',
				errored: true,
				warnings: [
					{
						line: 1,
						column: 1,
						rule: 'bar',
						severity: 'error',
						text: 'Unexpected foo',
					},
				],
				deprecations: [],
				invalidOptionWarnings: [],
        parseErrors: [],
			},
		];

		const output = prepareFormatterOutput(results, printResults);
		expect(output).toBe(stripIndent(`
path/to/file.css
 1:1  ×  Unexpected foo  bar

1 problem (1 error, 0 warnings)`));
	});

	it('removes rule name from warning text', () => {
		const results: LintResultWithTodo[] = [
			{
				source: 'path/to/file.css',
				errored: true,
				warnings: [
					{
						line: 1,
						column: 1,
						rule: 'rule-name',
						severity: 'warning',
						text: 'Unexpected foo (rule-name)',
					},
				],
				deprecations: [],
				invalidOptionWarnings: [],
        parseErrors: [],
			},
		];

		const output = prepareFormatterOutput(results, printResults);

		expect(output).toBe(stripIndent`
path/to/file.css
 1:1  ‼  Unexpected foo  rule-name

1 problem (0 errors, 1 warning)`);
	});

	it('outputs warnings without stdout `TTY`', () => {
		process.stdout.isTTY = false;

		const results: LintResultWithTodo[] = [
			{
				source: 'path/to/file.css',
				errored: true,
				warnings: [
					{
						line: 1,
						column: 1,
						rule: 'bar',
						severity: 'error',
						text: 'Unexpected foo',
					},
				],
				deprecations: [],
				invalidOptionWarnings: [],
        parseErrors: [],
			},
		];

		const output = prepareFormatterOutput(results, printResults);

		expect(output).toBe(stripIndent`
path/to/file.css
 1:1  ×  Unexpected foo  bar

1 problem (1 error, 0 warnings)`);
	});

	it('output warnings with more than 80 characters and `process.stdout.columns` equal 90 characters', () => {
		// For Windows tests
		process.stdout.isTTY = true;
		process.stdout.columns = 90;

		const results: LintResultWithTodo[] = [
			{
				source: 'path/to/file.css',
				errored: true,
				warnings: [
					{
						line: 1,
						column: 1,
						rule: 'bar-very-very-very-very-very-long',
						severity: 'error',
						text: 'Unexpected very very very very very very very very very very very very very long foo',
					},
				],
				deprecations: [],
				invalidOptionWarnings: [],
        parseErrors: [],
			},
		];

		const output = prepareFormatterOutput(results, printResults);

		expect(output).toBe(stripIndent`
path/to/file.css
 1:1  ×  Unexpected very very very very very very very  bar-very-very-very-very-very-long
         very very very very very very long foo

1 problem (1 error, 0 warnings)`);
	});


	it('condenses deprecations and invalid option warnings', () => {
		const results: LintResultWithTodo[] = [
			{
				source: 'file.css',
				deprecations: [
					{
						text: 'Deprecated foo',
						reference: 'bar',
					},
				],
				invalidOptionWarnings: [
					{
						text: 'Unexpected option for baz',
					},
				],
				errored: true,
				warnings: [],
        parseErrors: [],
			},
			{
				source: 'file2.css',
				deprecations: [
					{
						text: 'Deprecated foo',
						reference: 'bar',
					},
				],
				invalidOptionWarnings: [
					{
						text: 'Unexpected option for baz',
					},
				],
				errored: true,
				warnings: [],
        parseErrors: [],
			},
		];

		const output = prepareFormatterOutput(results, printResults);

		expect(output).toBe(stripIndent`
Invalid Option: Unexpected option for baz

Deprecation Warning: Deprecated foo See: bar`);
	});

	it('handles ignored file', () => {
		const results = [
			{
				source: 'file.css',
				warnings: [],
				deprecations: [],
				invalidOptionWarnings: [],
				ignored: true,
        parseErrors: [],
			},
		];

		const output = prepareFormatterOutput(results, printResults);

		expect(output).toBe('');
	});

	it('handles empty messages', () => {
		const results: LintResultWithTodo[] = [
			{
				source: 'path/to/file.css',
				errored: true,
				warnings: [
					{
						line: 1,
						column: 1,
						rule: 'bar',
						severity: 'error',
						text: '',
					},
				],
				deprecations: [],
				invalidOptionWarnings: [],
        parseErrors: [],
			},
		];

		const output = prepareFormatterOutput(results, printResults);

		expect(output).toBe(stripIndent`
path/to/file.css
 1:1  ×     bar

1 problem (1 error, 0 warnings)`);
	});
});