import chalk from 'chalk';

export class TestLogger {
  private static instance: TestLogger;
  private verbose: boolean = false;

  private constructor() {}

  static getInstance(): TestLogger {
    if (!TestLogger.instance) {
      TestLogger.instance = new TestLogger();
    }
    return TestLogger.instance;
  }

  setVerbose(verbose: boolean) {
    this.verbose = verbose;
  }

  info(message: string, details?: any) {
    console.log(chalk.blue('ℹ'), message);
    if (this.verbose && details) {
      console.log(chalk.gray(JSON.stringify(details, null, 2)));
    }
  }

  success(message: string, details?: any) {
    console.log(chalk.green('✅'), message);
    if (this.verbose && details) {
      console.log(chalk.gray(JSON.stringify(details, null, 2)));
    }
  }

  warning(message: string, details?: any) {
    console.log(chalk.yellow('⚠️'), message);
    if (this.verbose && details) {
      console.log(chalk.gray(JSON.stringify(details, null, 2)));
    }
  }

  error(message: string, details?: any) {
    console.log(chalk.red('❌'), message);
    if (this.verbose && details) {
      console.log(chalk.gray(JSON.stringify(details, null, 2)));
    }
  }

  step(step: number, total: number, message: string) {
    console.log(chalk.cyan(`[${step}/${total}]`), message);
  }

  section(title: string) {
    console.log('\n' + chalk.bold.underline(title));
    console.log(chalk.gray('='.repeat(title.length + 10)));
  }

  result(testName: string, status: 'PASS' | 'FAIL' | 'SKIP', duration: number, error?: string) {
    const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
    const statusColor = status === 'PASS' ? chalk.green : status === 'FAIL' ? chalk.red : chalk.yellow;
    
    console.log(
      statusIcon,
      statusColor(status),
      chalk.bold(testName),
      chalk.gray(`(${duration}ms)`)
    );
    
    if (error && status === 'FAIL') {
      console.log(chalk.red('  └─ Error:'), chalk.gray(error));
    }
  }

  summary(suite: any) {
    console.log('\n' + chalk.bold.underline('테스트 결과 요약'));
    console.log(chalk.gray('='.repeat(30)));
    
    console.log(chalk.green(`✅ 성공: ${suite.passCount}`));
    console.log(chalk.red(`❌ 실패: ${suite.failCount}`));
    console.log(chalk.yellow(`⏭️ 건너뜀: ${suite.skipCount}`));
    console.log(chalk.blue(`⏱️ 총 시간: ${suite.totalDuration}ms`));
    
    const successRate = suite.passCount / (suite.passCount + suite.failCount) * 100;
    if (successRate >= 90) {
      console.log(chalk.green(`\n🎉 성공률: ${successRate.toFixed(1)}% - 훌륭합니다!`));
    } else if (successRate >= 70) {
      console.log(chalk.yellow(`\n⚠️ 성공률: ${successRate.toFixed(1)}% - 개선이 필요합니다.`));
    } else {
      console.log(chalk.red(`\n🚨 성공률: ${successRate.toFixed(1)}% - 심각한 문제가 있습니다.`));
    }
  }
} 