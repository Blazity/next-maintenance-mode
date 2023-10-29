<p align="center">
  <h2 align="center">Next.js Maintenance Mode 🛠️</h2>
  <p align="center">
<a href="https://github.com/Blazity/next-maintenance-mode" target="_blank"><img src="https://img.shields.io/badge/Next.js-Experts-yellowgreen.svg" style="display: inherit;"/></a>
<a href="https://github.com/Blazity/next-maintenance-mode" target="_blank"><img alt="Blazity" src="https://img.shields.io/badge/Author-Blazity-green.svg" style="display: inherit;"/></a>
<a href="https://opensource.org/licenses/MIT/" target="_blank"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-blue.svg" style="display: inherit;"/></a>
  </p>
  <br>
</p>

![Alt Text](https://github.com/Blazity/next-maintenance-mode/raw/main/gif.gif?raw=true 'example usage')

## Overview

`next-maintenance-mode` is a middleware specially designed for Next.js applications, enabling you to easily toggle maintenance mode on and off. When activated, it redirects users to a designated maintenance page. Its compatibility with configuration providers such as Upstash and Edge Config allows for flexible and dynamic maintenance state management.

## Motivation

Setting up a maintenance mode in Next.js apps can be a hassle, particularly on certain hosting providers, which lack built-in support for this feature. Current methods are time-consuming and usually leave API routes vulnerable.

To solve this, we've created a straightforward solution that lets you choose between two different providers, making the setup process for maintenance mode quicker and more cost-effective, without skimping on security. This solution also includes an optional caching feature to help save bandwidth.

| Provider           | Reads (free plan)      |
| ------------------ | ---------------------- |
| Vercel/Edge-Config | 50k/month              |
| Upstash/Redis      | ~ 300k/month (10k/day) |

## Features

- ⚡️ **Next.js Compatibility**: Out-of-the-box integration with the new Next.js app directory, providing a smooth user experience.
- 🛠️ **Seamless Integration**: Designed to work hand-in-hand with Next.js applications, ensuring an intuitive setup process and seamless operation.
- 📚 **Provider Options**: Offers the flexibility to choose between Upstash and Edge Config as configuration providers, allowing you to tailor the solution to your existing workflow and tools.
- 💻 **Simple API**: One Wrapper to Rule Them All - `withMaintenanceMode`
- 💾 **Bandwidth Reduction**: Our optional caching feature reduces bandwidth usage, making your maintenance mode not only more efficient but also cost-effective.
- 🔄 **Dynamic Toggle**: Easily toggle maintenance mode on and off without the need for a complete app rebuild, saving you time and effort.

## Installation

To get started with `next-maintenance-mode`, you can install the package using your preferred package manager:

```bash
$ yarn add next-maintenance-mode

# or

$ npm install next-maintenance-mode

# or

$ pnpm i next-maintenance-mode
```

## Usage

To integrate `next-maintenance-mode` into your Next.js application, insert the following code into your middleware file.

```javascript
import { withMaintenanceMode } from 'next-maintenance-mode'

const middlewareOptions = {
  provider: 'upstash' | 'edge-config', // Required
  maintenancePageSlug: '/maintenance', // Optional
  key: 'your_key_here', // Optional
  cacheTime: 'number', //Optional - defined in ms for e.g. 60000 = one minute
}

withMaintenanceMode(
  {
    beforeCheck: NextMiddleware, // function which will be executed before checking the maintenance mode (if an instance of NextResponse is returned, checking maintenance mode status & afterCheck is skipped) 
    afterCheck: NextMiddleware, // function which will be executed after checking the maintenance mode (only if maintenance mode status is set to false)
  },
  'your_connection_string_here',
  middlewareOptions,
)
```

Before using the middleware, you need to configure it with the necessary settings. Here are the options you can specify:

- **provider:** Identify your configuration provider, choose between 'upstash' or 'edge-config'. This field is mandatory.
- **maintenancePageSlug:** Specify the route to your maintenance page. The default setup directs to '/maintenance'.
- **key:** Create a unique key to indicate the maintenance mode state in your configuration provider, defaulting to 'isInMaintenanceMode'.
- **cacheTime:** Defined in milliseconds, determines how long data is stored in the cache before being refreshed. Utilizing an LRU (Least Recently Used) caching algorithm, helps to save bandwidth.

⚠️ Keep in mind, due to edge functions nature the LRU cache might occasionally reset, but it's nothing to worry about. If this happens, the status is automatically checked in the provider and updated. This won't affect passed middleware's functions - they are not cached.

### Setting maintenance status from different locations:

To toggle the maintenance mode status directly through code, you can use the updateMaintenanceModeStatus function. Here's how you can call this function with appropriate parameters:

```javascript
updateMaintenanceModeStatus(true, {
    provider: 'upstash' | 'edge-config', // specify the provider
    connectionString: 'your_connection_string_here', // provide your connection string
    key?: 'your_key_here', // optional, default is "isInMaintenanceMode"
    maintenanceEdgeConfigId?: 'your_edge_config_id_here', // necessary for edge-config provider
    maintenanceModeVercelApiToken?: 'your_vercel_api_token_here', // necessary for edge-config provider
  })
```

⚠️ Note that if caching is activated, alterations to the maintenance status might not take effect immediately.

### Access Parameters in Check Events:

You can directly access the following parameters during events:
- **req: NextRequest**
- **_next: NextFetchEvent**

These can be accessed in:
- `beforeCheck`
- `afterCheck`

**Example integration with next-auth:**
```javascript
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { withMaintenanceMode } from "next-maintenance-mode";
import { getToken } from "next-auth/jwt";

async function firstMiddleware(req: NextRequest, _next: NextFetchEvent) {

  const token = await getToken({ req });
  if (!token) {
    return NextResponse.rewrite(new URL("/sign-in", req.nextUrl));
  }
  if (token.role === "admin") {
    return NextResponse.next(); //If you want you can disable checking maintenance mode for users with an admin role
  }
}

async function secondMiddleware(req: NextRequest, _next: NextFetchEvent) {
  console.log("secondMiddleware");
}

export default withMaintenanceMode(
  { beforeCheck: firstMiddleware, afterCheck: secondMiddleware },
  process.env.MAINTENANCE_MODE_CONNECTON_STRING as any,
  {
    provider: process.env.MAINTENANCE_MODE_PROVIDER as any,
    maintenancePageSlug: process.env.MAINTENANCE_MODE_PAGE_SLUG,
    key: process.env.MAINTENANCE_MODE_KEY,
  }
);
```

#### The connection string structure differs between Upstash and Edge Config:

- **For Upstash:** Include both the URL and token, formatted as **`url@token`**.
- **For Edge Config:** Specify the API endpoint or path given by Edge Config.

## Error Messages

There are specific error messages that may be encountered while using the middleware:
| Error Message | Description |
|---------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Maintenance Key Missing Error | This error occurs if the maintenance key is not found in your configuration provider. It can be encountered when checking the maintenance mode state. |
| Invalid Connection String | This error is triggered when the connection string does not match the selected provider. |
| Unsupported Provider Error | This error is thrown when an unsupported provider is passed to the function. |
| Middleware Configuration Error | This error is thrown when neither `beforeCheck` nor `afterCheck` middleware functions are defined during the setup. It ensures that at least one of these functions is implemented to proceed with the maintenance mode check. |

## 🙌 Contribution

Contributions are always welcome! To contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch with a descriptive name.
3. Make your changes, and commit them.
4. Push your changes to the forked repository.
5. Create a pull request, and we'll review your changes.

## 📡 Community

If you're looking for help or simply want to share your thoughts about the project, we encourage you to join our Discord community. Here's the link: [https://blazity.com/discord](https://blazity.com/discord). It's a space where we exchange ideas and help one another. Everyone's input is appreciated, and we look forward to welcoming you.

<br />
<a href="https://blazity.com/discord" style="width: 100%; display: flex; justify-content: center;">
  <img src="https://discordapp.com/api/guilds/1111676875782234175/widget.png?style=banner2" alt="Blazity Discord Banner"/>
</a>
<br />
