# UI Builder Cookbook

This repository demonstrates how to integrate the Benchify API with a simple UI component builder application built with Next.js and Tailwind CSS.

## Overview

The UI Builder Cookbook provides a practical example of using the Benchify API to automatically repair and improve code generated by AI. The application allows users to:

1. Describe a UI component they want to build
2. Generate code for that component using AI
3. Automatically repair any issues in the code using the Benchify API
4. Preview the component in a live sandbox environment

## Features

- **AI-Powered UI Generation**: Uses OpenAI to generate UI component code based on user descriptions
- **Benchify Integration**: Demonstrates how to use the Benchify API to detect and fix issues in generated code
- **Live Preview**: Provides instant previews of components using E2B sandbox
- **Modern UI**: Built with Next.js 15 and Tailwind CSS v4
- **Component Library**: Uses shadcn components for a consistent, accessible UI

## Getting Started

### Prerequisites

- Node.js 18.x or later
- Benchify API key
- OpenAI API key
- E2B API key

### Environment Setup

Create a `.env.local` file in the project root with the following variables:

```
BENCHIFY_API_KEY=your_benchify_api_key
OPENAI_API_KEY=your_openai_api_key
E2B_API_KEY=your_e2b_api_key
```

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open http://localhost:5173 in your browser to use the application.

## How It Works

### Architecture

1. **Frontend**: Next.js application with React components and Tailwind CSS styling
2. **AI Generation**: OpenAI API integration to generate component code
3. **Code Repair**: Benchify API integration to fix issues in generated code
4. **Live Preview**: E2B sandbox to provide live previews of components

### Key Files

- `app/api/generate/route.ts`: API route that handles component generation
- `lib/benchify.ts`: Benchify API integration for code repair
- `lib/e2b.ts`: E2B sandbox integration for previewing components
- `components/ui-builder/*`: UI components for the application

## Benchify API Integration

This cookbook demonstrates how to use the Benchify API to automatically fix issues in code. The integration includes:

1. Preparing files for the Benchify API
2. Submitting code for repair
3. Applying fixes to the original code
4. Providing build output for debugging

Example usage can be found in `lib/benchify.ts`.

## Customization

You can customize this cookbook by:

1. Modifying the AI prompts in `lib/prompts.ts`
2. Changing the UI components in `components/ui-builder/*`
3. Adding additional features to the generation process

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [E2B](https://e2b.dev/)
- [OpenAI](https://openai.com/)
- [Benchify](https://benchify.com/)
