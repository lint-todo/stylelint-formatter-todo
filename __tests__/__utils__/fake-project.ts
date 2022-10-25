import {
  DaysToDecay,
  DaysToDecayByRule,
  LintTodoPackageJson,
  TodoConfigByEngine,
} from '@lint-todo/utils';
import { dirname, join } from 'path';
import { mkdirpSync, symlinkSync } from 'fs-extra';
import { BinTesterProject } from '@scalvert/bin-tester';

const DEFAULT_STYLELINT_CONFIG = `{
  "rules": {
    "property-no-unknown": true,
    "color-no-hex": true,
    "declaration-block-no-duplicate-properties": [
      true,
      {
        "severity": "warning"
      }
    ]
  }
}
`;

export class FakeProject extends BinTesterProject {
  static async getInstance(): Promise<FakeProject> {
    const project = new this();

    project.files['stylelint-config.json'] = DEFAULT_STYLELINT_CONFIG;

    await project.write();
    // link binary
    project.symlink(
      join(__dirname, '../..', 'node_modules', '.bin', 'stylelint'),
      join(project.baseDir, 'node_modules', '.bin', 'stylelint')
    );

    // link package
    project.symlink(
      join(__dirname, '../..', 'node_modules', 'stylelint'),
      join(project.baseDir, 'node_modules', 'stylelint')
    );

    // link formatter for FORMAT_TODO_AS tests
    project.symlink(
      join(__dirname, '../..', 'node_modules', '@microsoft'),
      join(project.baseDir, 'node_modules', '@microsoft')
    );

    return project;
  }

  constructor(name = 'fake-project', ...args: any[]) {
    super(name, ...args);

    this.pkg = {
      ...this.pkg,
      license: 'MIT',
      description: 'Fake project',
      repository: 'http://fakerepo.com',
    };
  }

  setShorthandPackageJsonTodoConfig(daysToDecay: DaysToDecay): Promise<void> {
    this.pkg = Object.assign({}, this.pkg, {
      lintTodo: {
        daysToDecay,
      },
    });

    return this.write();
  }

  setPackageJsonTodoConfig(
    daysToDecay: DaysToDecay,
    daysToDecayByRule?: DaysToDecayByRule
  ): Promise<void> {
    const todoConfig: LintTodoPackageJson = {
      lintTodo: {
        stylelint: {
          daysToDecay,
        },
      },
    };

    if (daysToDecayByRule) {
      (<TodoConfigByEngine>todoConfig.lintTodo)!['stylelint'].daysToDecayByRule =
        daysToDecayByRule;
    }

    this.pkg = Object.assign({}, this.pkg, todoConfig);

    return this.write();
  }

  setLintTodorc(
    daysToDecay: DaysToDecay,
    daysToDecayByRule?: DaysToDecayByRule
  ): Promise<void> {
    const todoConfig: TodoConfigByEngine = {
      stylelint: {
        daysToDecay,
      },
    };

    if (daysToDecayByRule) {
      todoConfig['stylelint'].daysToDecayByRule = daysToDecayByRule;
    }

    return this.write({
      '.lint-todorc.js': `module.exports = ${JSON.stringify(
        todoConfig,
        // eslint-disable-next-line unicorn/no-null
        null,
        2
      )}`,
    });
  }

  symlink(source: string, target: string): void {
    mkdirpSync(dirname(target));
    symlinkSync(source, target);
  }
}
