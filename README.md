# forms



## Working on it

In a LunarHUE workspace this repo is checked out at `~/repos/forms` and runs
in its own pod.

- **Shell in the pod:** `ssh forms.<workspace>.repos` from your machine, or
  `ws attach forms` in the workspace.
- **Long-running commands** (dev servers, watchers):
  `ws run forms --name dev --wait-port <port> -- <command>`, then
  `ws ps`, `ws logs forms dev` and `ws stop forms dev`.
- **Dev environment:** `flake.nix` defines it. The pod enters its default
  devShell for every command. Add tools to `packages` there and commit
  `flake.lock`.
- **One-off commands from the parent:**
  `ws-route forms <dir> -- <command>` runs a command in the pod at
  `/workspace/<dir>` (`.` for the root), with the dev environment loaded.
- **Outside Coder:** `.devcontainer/devcontainer.json` opens the repo in the
  same image the pod uses. Run `docker login ghcr.io` first; the image is
  private.
