# next-maintenance-mode

## Overview

`next-maintenance-mode` is a middleware specially designed for Next.js applications, enabling you to easily toggle maintenance mode on and off. When activated, it redirects users to a designated maintenance page, while still keeping essential parts of your site operational. Its compatibility with multiple configuration providers such as Upstash and Edge Config allows for flexible and dynamic maintenance state management.

## Features

- ⚡️ **App Directory Ready**: Easily integrates with the new Next.js app directory.
- 🛠️ **Seamless Integration**: Designed to work hand-in-hand with Next.js applications, ensuring an intuitive setup process and seamless operation.
- 📚 **Multi-Provider Support**: Flexibility to choose between Upstash and Edge Config for configuration, adapting to your preferred workflow and tools.
- 💻 **Simple API**: With a straightforward API and minimal setup requirements, integrating `next-maintenance-mode` is a breeze.

## Installation

To get started with `next-maintenance-mode`, you can install the package using your preferred package manager:

```bash
$ yarn add next-maintenance-mode

# or

$ npm install --save-dev next-maintenance-mode

# or

$ pnpm i -D next-maintenance-mode
```

## Configuration
Before using the middleware, you need to configure it with the necessary settings. Here are the options you can specify:

- **provider:** Identify your configuration provider, choose between 'upstash' or 'edge-config'. This field is mandatory.
- **maintenancePageSlug:** Specify the route to your maintenance page. The default setup directs to '/maintenance'.
- **key:** Create a unique key to indicate the maintenance mode state in your configuration provider, defaulting to 'isInMaintenanceMode'.

### The connection string structure differs between Upstash and Edge Config:

- **For Upstash:** Include both the URL and token, formatted as url@token.
- **For Edge Config:** Specify the API endpoint or path given by Edge Config.
  
## Usage

To integrate `next-maintenance-mode` into your Next.js application, insert the following code into your middleware file.

```javascript
import { withMaintenanceMode, Provider } from 'next-maintenance-mode';

const middlewareOptions = {
  provider: 'upstash' | 'edge-config', // Mandatory
  maintenancePageSlug: '/maintenance', // Optional
  key: 'your_key_here', // Optional
};

withMaintenanceMode({
  beforeCheck: NextMiddleware, // function which will be executed before checking the maintenance mode
  afterCheck: NextMiddleware // function which will be executed after checking the maintenance mode
}, 'your_connection_string_here', middlewareOptions);
