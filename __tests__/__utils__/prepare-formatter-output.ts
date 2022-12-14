import stripAnsi from 'strip-ansi';
import { 
	Formatter,
	LintResultWithTodo,
	TodoFormatterOptions
} from '../../src/types';

const symbolConversions = new Map();

symbolConversions.set('ℹ', 'i');
symbolConversions.set('✔', '√');
symbolConversions.set('⚠', '‼');
symbolConversions.set('✖', '×');

export default function prepareFormatterOutput(results: LintResultWithTodo[], formatter: Formatter, options: TodoFormatterOptions) {
	let output = stripAnsi(formatter(results, options)).trim();

	symbolConversions.forEach((win, nix) => {
		output = output.replace(new RegExp(nix, 'g'), win);
	});

	return output;
};