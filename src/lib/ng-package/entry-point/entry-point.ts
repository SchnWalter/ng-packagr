import * as path from 'path';
import { NgPackageConfig } from '../../../ng-package.schema';
import { CssUrl } from '../../styles/stylesheet-processor';
import { ensureUnixPath } from '../../utils/path';

/** A list of output absolute paths for various formats */
export interface DestinationFiles {
  /** Absolute path of this entry point `declarations` */
  declarations: string;
  /** Absolute path of this entry point `metadata` */
  metadata: string;
  /** Absolute path of this entry point `FESM2015` module */
  fesm2015: string;
  /** Absolute path of this entry point `ESM2015` module */
  esm2015: string;
  /** Absolute path of this entry point `UMD` bundle */
  umd: string;
  /** Absolute path of this entry point `UMD` minified bundle */
  umdMinified: string;
}

/**
 * An entry point - quoting Angular Package Format - is:
 *
 * > a module intended to be imported by the user. It is referenced by a unique module ID and
 * > exports the public API referenced by that module ID. An example is `@angular/core` or
 * > `@angular/core/testing`. Both entry points exist in the `@angular/core` package, but they
 * > export different symbols. A package can have many entry points.
 *
 * #### Public API, source file tree and build output
 *
 * An entry point serves as the root of a source tree.
 * The entry point's public API references one TypeScript source file (`*.ts`).
 * That source file, e.g. `public_api.ts`, references other source files who in turn may reference
 * other source files, thus creating a tree of source code files.
 * The source files may be TypeScript (`*.ts`), Templates (`.html`) or Stylesheets
 * (`.css`, `.scss`, ..), or other formats.
 *
 * The compilation process for an entry point is a series of transformations applied to the source
 * files, e.g. TypeScript compilation, Inlining of Stylesheets and Templates, and so on.
 * As a result of the compilation process, an entry point is transpiled to a set of artefacts
 * (the build output) which include a FESM'15 Bundle, a FESM'5 Bundle, AoT metadata, TypeScript
 * type definitions, and so on.
 *
 * #### Representation in the domain
 *
 * The set of artefacts is reflected by `NgArtefacts`;
 * one `NgEntryPoint` relates to one `NgArtefacts`.
 * The parent package of an entry point is reflected by `NgPackage`.
 */
export class NgEntryPoint {
  /**
   * @param packageJson Values from the `package.json` file of this entry point.
   * @param ngPackageJson Values from either the `ngPackage` option (from `package.json`) or values from `ng-package.json`.
   * @param basePath Absolute directory path of this entry point's `package.json` location.
   * @param parent The parent entry point, if any.
   */
  constructor(
    public readonly packageJson: Record<string, any>,
    public readonly ngPackageJson: NgPackageConfig,
    public readonly basePath: string,
    private readonly parent?: NgEntryPoint,
  ) {}

  /** Absolute file path of the entry point's source code entry file. */
  public get entryFilePath(): string {
    return path.resolve(this.basePath, this.entryFile);
  }

  /** Whether or not the entrypoint is secondary */
  public get isSecondaryEntryPoint(): boolean {
    return !!this.parent;
  }

  /** Absolute directory path of the entrypoint package.json. */
  public get destinationPath(): string {
    if (this.parent) {
      return path.join(this.libraryDestinationPath, this.sourceRelativePath);
    } else {
      return this.libraryDestinationPath;
    }
  }

  /** Absolute directory path of the library output directory. */
  public get libraryDestinationPath(): string {
    if (this.parent) {
      return this.parent.libraryDestinationPath;
    } else {
      return path.resolve(this.basePath, this.$get('dest'));
    }
  }

  /**
   * The entry source path relative to the parent entry point source path.
   */
  private get sourceRelativePath(): string {
    if (this.parent) {
      return path.relative(this.parent.basePath, this.basePath);
    } else {
      return '';
    }
  }

  public get destinationFiles(): DestinationFiles {
    const libDest = this.libraryDestinationPath;
    const entryPointDest = this.destinationPath;
    const moduleFileName = this.flatModuleFile;
    return {
      metadata: path.join(entryPointDest, `${moduleFileName}.metadata.json`),
      declarations: path.join(entryPointDest, `${moduleFileName}.d.ts`),
      esm2015: path.join(libDest, 'esm2015', this.sourceRelativePath, `${moduleFileName}.js`),
      fesm2015: path.join(libDest, 'fesm2015', `${moduleFileName}.js`),
      umd: path.join(libDest, 'bundles', `${moduleFileName}.umd.js`),
      umdMinified: path.join(libDest, 'bundles', `${moduleFileName}.umd.min.js`),
    };
  }

  public $get(key: string): any {
    const parts = key.split('.');
    let value = this.ngPackageJson as unknown;
    for (const key of parts) {
      if (typeof value === 'object' && value.hasOwnProperty(key)) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  public get entryFile(): string {
    return this.$get('lib.entryFile');
  }

  public get cssUrl(): CssUrl {
    return this.$get('lib.cssUrl');
  }

  public get umdModuleIds(): { [key: string]: string } {
    return this.$get('lib.umdModuleIds');
  }

  public get flatModuleFile(): string {
    return this.$get('lib.flatModuleFile') || this.flattenModuleId('-');
  }

  public get styleIncludePaths(): string[] {
    const includePaths = this.$get('lib.styleIncludePaths') || [];
    return includePaths.map(includePath =>
      path.isAbsolute(includePath) ? includePath : path.resolve(this.basePath, includePath),
    );
  }

  /**
   * The module ID is an "identifier of a module used in the import statements, e.g.
   * '@angular/core'. The ID often maps directly to a path on the filesystem, but this
   * is not always the case due to various module resolution strategies."
   */
  public get moduleId(): string {
    if (this.parent) {
      return ensureUnixPath(`${this.parent.moduleId}/${this.sourceRelativePath}`);
    } else {
      return this.packageJson['name'];
    }
  }

  /**
   * The UMD module ID registers a module on the old-fashioned JavaScript global scope.
   * Used by UMD bundles only.
   * Example: `@my/foo/bar` registers as `global['my']['foo']['bar']`.
   */
  public get umdId(): string {
    return this.$get('lib.umdId') || this.flattenModuleId();
  }

  /**
   * The AMD ID reflects a named module that is distributed in the UMD bundles.
   * @link http://requirejs.org/docs/whyamd.html#namedmodules
   */
  public get amdId(): string {
    return this.$get('lib.amdId') || this.moduleId;
  }

  private flattenModuleId(separator: string = '.') {
    if (this.moduleId.startsWith('@')) {
      return this.moduleId.substring(1).split('/').join(separator);
    } else {
      return this.moduleId.split('/').join(separator);
    }
  }

  /**
   * Enables the `"sideEffects": false` flag in `package.json`.
   * The flag is enabled and set to `false` by default which results in more aggressive optimizations applied by webpack v4 builds consuming the library.
   * To override the default behaviour, you need to set `"sideEffects": true` explicitly in your `package.json`.
   *
   * @link https://github.com/webpack/webpack/tree/master/examples/side-effects
   */
  public get sideEffects(): boolean | string[] {
    return this.packageJson['sideEffects'] || false;
  }
}
