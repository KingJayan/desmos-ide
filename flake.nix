{
  description = "desmos-ide — code your desmos graphs.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        isDarwin = pkgs.stdenv.hostPlatform.isDarwin;
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            bun
            git
            shellcheck
          ];

          shellHook =
            if isDarwin then ''
              if ! command -v swiftc >/dev/null; then
                echo "warning: swiftc not found — install Xcode or the command line tools."
                echo "         the compiler and the renderer still build; the native"
                echo "         helpers and the quick look extension do not."
              fi
            '' else ''
              echo "note: not macOS. 'bun test' and 'bun run build:view' work here;"
              echo "      the app bundle and the swift helpers are macOS only."
            '';
        };
      });
}
