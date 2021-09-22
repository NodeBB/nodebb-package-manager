## NodeBB Package Manager

The NodeBB Package Manager functions as a directory/index for every plugin that is published to npm.

The front-end interface is deprecated (though still runs), and the API is referenced by all NodeBBs to determine what packages are available and installable.

## Setup

Copy `launch.template` to `launch`, and make sure the file is set to executable.

[Create an OAuth App](https://github.com/settings/applications/new) (the `redirect_uri` is `/gh-callback`) and insert the client id and secret into the `launch` file. The secret is not used normally, it is only used during setup so you can step through the login flow and retrieve a long-lived access token. You can leave `GITHUB_TOKEN` empty for now.

Uncomment the OAuth flow route in `lib/routes/main.js`

Start nbbpm and start the login flow. It should send back the access token to the browser. Update `GITHUB_TOKEN` in `launch`, and clear `GITHUB_SECRET` if you prefer.

Restart nbbpm.

## Caveat Emptor

NodeBB Inc., NodeBB, and all of its contributors are not responsible for the content of any plugins published. You are advised to inspect the source code of
any plugins you wish to install, in order to determine it's safety.