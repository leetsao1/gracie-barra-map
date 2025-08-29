# Gracie Barra Map

An interactive map application for finding Gracie Barra locations across the United States. Built with Next.js, Mapbox, and Airtable.

## Features

- Interactive map with Gracie Barra locations
- Search functionality with geolocation
- Distance-based filtering
- Premium location filtering
- Responsive design
- Modal popups with location details

## Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Airtable account with API key
- Mapbox account with access token

## Setup

1. **Clone the repository**
   ```bash
   git clone git@github.com:leetsao1/gracie-barra-map.git
   cd gracie-barra-map
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Variables**
   Create a `.env.local` file in the root directory with the following variables:
   ```
   # Airtable Configuration
   NEXT_PUBLIC_AIRTABLE_BASE_ID=apprkakhR1gSO8JIj
   NEXT_PUBLIC_AIRTABLE_API_KEY=your_airtable_api_key_here
   
   # Mapbox Configuration
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
   ```

4. **Get API Keys**
   - **Airtable**: Create an account at [airtable.com](https://airtable.com) and get your API key from your account settings
   - **Mapbox**: Create an account at [mapbox.com](https://mapbox.com) and get your access token from your account dashboard

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
gracie-barra-map/
├── components/          # React components
│   ├── component.js     # Main map component
│   ├── map/            # Map-related components
│   ├── search/         # Search components
│   └── utils/          # Utility components
├── pages/              # Next.js pages
│   ├── api/           # API routes
│   ├── _app.js        # App wrapper
│   └── index.js       # Home page
├── public/             # Static assets
├── services/           # API services
│   ├── airtable.js    # Airtable API integration
│   ├── geolocation.js # Geolocation services
│   └── mapbox.js      # Mapbox API integration
├── styles/            # CSS styles
└── package.json       # Dependencies and scripts
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

## Technologies Used

- **Next.js** - React framework
- **Mapbox GL JS** - Interactive maps
- **Airtable** - Database and CMS
- **Bootstrap** - UI framework
- **React Modal** - Modal dialogs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

ISC License
