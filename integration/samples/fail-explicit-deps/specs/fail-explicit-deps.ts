import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';

describe(`fail-explicit-deps `, () => {
  describe(`library build error`, () => {
    it(`should have no build output`, () => {
      const exists = fs.existsSync(path.resolve(__dirname, '../dist'));
      expect(exists).to.be.false;
    });
  });
});
