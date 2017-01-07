![](http://i.imgur.com/u064S5b.png)
--------------------
_Ad-hoc secure messaging for all._

nullchat is an ad-hoc secure messaging app that allows two users to share a link in order to open a secure 
PGP end-to-end encrypted messaging tunnel.

### Getting Started
To run nullchat, clone the repository and install dependencies. nullchat does not store any information and
uses no database.
 - `yarn` or `npm install`
 - `nodemon` or `node _entrypoint.js`

## Implementation
The nullchat does not have any knowledge of the messages sent between users. It does not have access to the private
keys and merely relays the information from end to end. nullchat uses PGP to secure communications between the users.

To increase privacy, it is recommended to use HTTPS and HSTS on your server. If an attacker can modify the JavaScript sent to the client, there can be no expectation of privacy.

## Disclaimer
nullchat is a *toy* and has not gone through an indepndent security audit. You should not send sensitive information through nullchat, and the creators of nullchat hold no liability for any damages. 

```
Copyright 2017 Chaoyi Zha

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
