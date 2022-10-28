import { getFormatter } from '../../src/get-formatter';

describe('get-formatter', () => {
  it('can get a built-in formatter', () => {
    const formatter = getFormatter('compact');

    expect(typeof formatter).toEqual('function');
  });

  it('can get a formatter from an installed package', () => {
    const formatter = getFormatter('stylelint-sarif-formatter');

    expect(typeof formatter).toEqual('function');
    expect(formatter.name).toEqual('sarifFormatter');
  });
});
