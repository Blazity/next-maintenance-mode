# next-maintenance-mode

## Overview

`next-maintenance-mode` is a middleware for Next.js applications that enables you to easily toggle maintenance mode on and off, guiding users to a maintenance page while keeping your site operational. It supports multiple configuration providers like Upstash and Edge Config to manage your maintenance state dynamically.

## Features

- Seamless integration with Next.js applications.
- Supports multiple providers (Upstash and Edge Config) for flexible configuration.
- Simple API with minimal setup required.

```
import { withMaintenanceMode, Provider } from 'next-maintenance-mode';

const middlewareOptions = {
  provider: Provider.UPSTASH, // or Provider.EDGE_CONFIG
  maintenancePageSlug: '/maintenance', // Optional: default is '/maintenance'
  key: 'your_key_here', // Optional
};

withMaintenanceMode(YourNextMiddlewareFunction, 'your_connection_string_here', middlewareOptions);
```

## Configuration
You can configure the middleware using the following options:

- provider: The configuration provider, either 'upstash' or 'edge-config'. This field is required.
- maintenancePageSlug: The route to your maintenance page. Default is '/maintenance'.
- key: A unique key to identify the maintenance mode state in your configuration provider. Default is 'isInMaintenanceMode'.
  
### Connection Strings
The format for the connection string varies between Upstash and Edge Config:

- For Upstash: The connection string should include the URL and token (format: protocol://url@token).
- For Edge Config: The connection string should be the API endpoint or path provided by Edge Config.
