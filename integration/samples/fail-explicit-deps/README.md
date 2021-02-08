# fail-explicit-deps

The build is expected to fail because of a missing explicit dependency, causing the output directory to not exist.

NOTE: The '@angular/cdk' TypeScript module is not defined in the library package.json, but it exists in the current workspace.

TODO: Update ng-packagr so that this build starts to fail.
