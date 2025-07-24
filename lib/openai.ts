// lib/openai.ts
import { streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { REACT_APP_SYSTEM_PROMPT, REACT_APP_USER_PROMPT, TEMPERATURE, MODEL, EDIT_SYSTEM_PROMPT, createEditUserPrompt } from './prompts';
import { benchifyFileSchema } from './schemas';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}

// Schema for a single file
const fileSchema = z.object({
  path: z.string(),
  contents: z.string()
});

// Generate a new application using AI SDK
export async function createNewApp(
  description: string,
): Promise<Array<{ path: string; contents: string }>> {
  console.log("Creating app with description: ", description);

  try {
    const { elementStream } = streamObject({
      model: openai(MODEL),
      output: 'array',
      schema: fileSchema,
      temperature: TEMPERATURE,
      messages: [
        { role: 'system', content: REACT_APP_SYSTEM_PROMPT },
        { role: 'user', content: REACT_APP_USER_PROMPT(description) }
      ]
    });

    const files = [];
    for await (const file of elementStream) {
      files.push(file);
    }

    if (!files.length) {
      throw new Error("Failed to generate files - received empty response");
    }

    console.log("Generated files: ", files);

    return files;
  } catch (error) {
    console.error('Error generating app:', error);
    throw error;
  }
}

// Helper function to merge updated files with existing files
function mergeFiles(existingFiles: z.infer<typeof benchifyFileSchema>, updatedFiles: z.infer<typeof benchifyFileSchema>): z.infer<typeof benchifyFileSchema> {
  const existingMap = new Map(existingFiles.map(file => [file.path, file]));

  // Apply updates
  updatedFiles.forEach(updatedFile => {
    existingMap.set(updatedFile.path, updatedFile);
  });

  return Array.from(existingMap.values());
}

// Edit existing application using AI SDK and merge results
export async function editApp(
  existingFiles: z.infer<typeof benchifyFileSchema>,
  editInstruction: string,
): Promise<z.infer<typeof benchifyFileSchema>> {
  console.log("Editing app with instruction: ", editInstruction);
  console.log('Existing files:', existingFiles.map(f => ({ path: f.path, contentLength: f.contents.length })));

  try {
    const { elementStream } = streamObject({
      model: openai('gpt-4o-mini'),
      output: 'array',
      schema: fileSchema,
      temperature: 0.3, // Lower temperature for more consistent edits
      messages: [
        { role: 'system', content: EDIT_SYSTEM_PROMPT },
        { role: 'user', content: createEditUserPrompt(existingFiles, editInstruction) }
      ]
    });

    const updatedFiles = [];
    for await (const file of elementStream) {
      updatedFiles.push(file);
    }

    if (!updatedFiles.length) {
      throw new Error("Failed to generate updated files - received empty response");
    }

    console.log("Generated updated files: ", updatedFiles.map(f => ({ path: f.path, contentLength: f.contents.length })));

    // Merge the updated files with the existing files
    const mergedFiles = mergeFiles(existingFiles, updatedFiles);
    console.log('Final merged files:', mergedFiles.map(f => ({ path: f.path, contentLength: f.contents.length })));

    return mergedFiles;
  } catch (error) {
    console.error('Error editing app:', error);
    throw error;
  }
}

// Main function to handle both generation and editing
export async function generateAppCode(
  description: string,
  existingFiles?: z.infer<typeof benchifyFileSchema>,
  editInstruction?: string,
  useBuggyCode: boolean = false
): Promise<z.infer<typeof benchifyFileSchema>> {
  // Determine if this is an edit request or new generation
  if (existingFiles && editInstruction) {
    // Edit existing code (including error fixes)
    console.log('📝 Processing edit request...');
    return await editApp(existingFiles, editInstruction);
  } else {
    // Generate new app
    console.log('🆕 Processing new generation request...');
    if (useBuggyCode) {
      console.log('🐛 Using buggy code as requested');
      // Return the buggy code in the expected format
      return [
        {
          path: "src/App.tsx",
          contents: `export interface Vehicle {
    id: string
    title: string
    price: number
    year: number
    make: string
    model: string
    mileage: number
    transmission: string
    bodyType: string
    fuelType: string
    color: string
    location: string
    status: 'Available' | 'Urgent' | 'Sold Out'
    features: string[]
    description: string
    images: string[]
    vin: string
    engine: string
    datePosted: string
  }
  
  export const vehicles: Vehicle[] = [
    {
      id: 'v1',
      title: '2022 Honda Accord Touring',
      price: 28900,
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      mileage: 24000,
      transmission: 'Automatic',
      bodyType: 'Sedan',
      fuelType: 'Gasoline',
      color: 'Crystal Black Pearl',
      location: 'Downtown Branch',
      status: 'Available',
      features: [
        'Honda Sensing Suite',
        'Leather Seats',
        'Sunroof',
        'Navigation System',
        'Apple CarPlay & Android Auto',
        'Wireless Phone Charger',
        'LED Headlights',
        '19-inch Alloy Wheels',
      ],
      description: 'This 2022 Honda Accord Touring is a premium sedan offering exceptional comfort, advanced technology features, and impressive fuel efficiency. The vehicle has been meticulously maintained and comes with a full service history. The Crystal Black Pearl exterior is complemented by a luxurious leather interior with heated and ventilated seats. Perfect for both daily commuting and long road trips.',
      images: [
        'https://images.unsplash.com/photo-1583267746897-2cf415887172?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
      ],
      vin: '1HGCV2F91NA123456',
      engine: '1.5L Turbocharged I4',
      datePosted: 'July 10, 12:30 PM',
    },
    {
      id: 'v2',
      title: '2023 Toyota RAV4',
      price: 31500,
      year: 2023,
      make: 'Toyota',
      model: 'RAV4',
      mileage: 8000,
      transmission: 'Automatic',
      bodyType: 'SUV',
      fuelType: 'Hybrid',
      color: 'Magnetic Gray',
      location: 'Main Showroom',
      status: 'Urgent',
      features: [
        'Toyota Safety Sense 2.0',
        'All-Wheel Drive',
        'Hybrid Synergy Drive',
        'Smart Key System',
        'Dual-Zone A/C',
        'Power Liftgate',
        'Roof Rails',
        'LED Headlights',
      ],
      description: 'This 2023 Toyota RAV4 Hybrid combines versatility, efficiency, and advanced technology in one stylish package. With only 8,000 miles, this SUV is practically new. The hybrid powertrain delivers exceptional fuel economy without compromising on performance. Features include Toyota Safety Sense 2.0, all-wheel drive for enhanced traction, and a comfortable, tech-filled interior perfect for families and adventurers alike.',
      images: [
        'https://images.unsplash.com/photo-1568844293986-ca3c5c1bf2bb?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
      ],
      vin: '2T3F1RFV8PC123456',
      engine: '2.5L Hybrid I4',
      datePosted: 'July 12, 12:48 PM',
    },
    {
      id: 'v3',
      title: '2021 BMW X5 xDrive40i',
      price: 52800,
      year: 2021,
      make: 'BMW',
      model: 'X5',
      mileage: 18500,
      transmission: 'Automatic',
      bodyType: 'SUV',
      fuelType: 'Gasoline',
      color: 'Alpine White',
      location: 'Luxury Showroom',
      status: 'Available',
      features: [
        'xDrive All-Wheel Drive',
        'Live Cockpit Professional',
        'Panoramic Sunroof',
        'Harman Kardon Sound System',
        'Heated & Ventilated Seats',
        'Driving Assistant Professional',
        '20-inch Alloy Wheels',
        'Adaptive LED Headlights',
      ],
      description: 'Experience luxury and performance with this 2021 BMW X5 xDrive40i. This premium SUV offers the perfect blend of sophistication, technology, and driving dynamics. The powerful 3.0L TwinPower Turbo engine delivers exhilarating performance while the xDrive all-wheel drive system ensures confident handling in all conditions. Inside, you'll find a meticulously crafted interior with premium materials and cutting-edge technology including the BMW Live Cockpit Professional.',
      images: [
        'https://images.unsplash.com/photo-1580273916550-e323be2ae537?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1556189250-72ba954cfc2b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
      ],
      vin: '5UXCR6C06M9E12345',
      engine: '3.0L TwinPower Turbo I6',
      datePosted: 'July 8, 10:15 AM',
    },
    {
      id: 'v4',
      title: '2020 Tesla Model 3',
      price: 36900,
      year: 2020,
      make: 'Tesla',
      model: 'Model 3',
      mileage: 22000,
      transmission: 'Automatic',
      bodyType: 'Sedan',
      fuelType: 'Electric',
      color: 'Pearl White',
      location: 'Downtown Branch',
      status: 'Sold Out',
      features: [
        'Autopilot',
        '15-inch Touchscreen',
        'Premium Interior',
        'Glass Roof',
        'Dual Motor All-Wheel Drive',
        'Heated Seats',
        '18-inch Aero Wheels',
        'Enhanced Autopilot',
      ],
      description: 'This 2020 Tesla Model 3 represents the future of automotive technology. With zero emissions and instant acceleration, this electric sedan delivers a unique driving experience. The minimalist interior is centered around the 15-inch touchscreen that controls nearly all vehicle functions. Features include Autopilot for semi-autonomous driving, premium audio system, and over-the-air updates that continuously improve the vehicle over time.',
      images: [
        'https://images.unsplash.com/photo-1560958089-b8a1929cea89?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1551826152-d7248d8fa722?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1549927681-0b673b8243ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
      ],
      vin: '5YJ3E1EA8LF123456',
      engine: 'Electric Dual Motor',
      datePosted: 'July 5, 3:22 PM',
    },
    {
      id: 'v5',
      title: '2022 Ford F-150 Lariat',
      price: 45700,
      year: 2022,
      make: 'Ford',
      model: 'F-150',
      mileage: 15800,
      transmission: 'Automatic',
      bodyType: 'Truck',
      fuelType: 'Gasoline',
      color: 'Velocity Blue',
      location: 'Main Showroom',
      status: 'Urgent',
      features: [
        '3.5L EcoBoost V6',
        'SYNC 4 with 12-inch Display',
        'Pro Power Onboard',
        '360-Degree Camera',
        'Leather-Trimmed Seats',
        'Power-Deployable Running Boards',
        'LED Headlamps & Taillamps',
        'Trailer Tow Package',
      ],
      description: 'This 2022 Ford F-150 Lariat combines capability, technology, and comfort in America\'s best-selling truck. Powered by the responsive 3.5L EcoBoost V6 engine, this truck delivers impressive performance and towing capacity. The interior features premium leather seating, the advanced SYNC 4 system with a 12-inch touchscreen, and the innovative Pro Power Onboard generator system that allows you to power tools and appliances directly from the truck.',
      images: [
        'https://images.unsplash.com/photo-1605893477799-b99e3b8b93fe?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1609963629358-24a192108de2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1595758628419-9e570e91a272?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
      ],
      vin: '1FTFW1ED3NFB12345',
      engine: '3.5L EcoBoost V6',
      datePosted: 'July 11, 9:05 AM',
    },
    {
      id: 'v6',
      title: '2021 Mercedes-Benz GLC 300',
      price: 41900,
      year: 2021,
      make: 'Mercedes-Benz',
      model: 'GLC 300',
      mileage: 19500,
      transmission: 'Automatic',
      bodyType: 'SUV',
      fuelType: 'Gasoline',
      color: 'Lunar Blue Metallic',
      location: 'Luxury Showroom',
      status: 'Available',
      features: [
        '4MATIC All-Wheel Drive',
        'MBUX Infotainment System',
        'Burmester Surround Sound',
        'Panorama Roof',
        'Heated Front Seats',
        '64-Color Ambient Lighting',
        '19-inch AMG Wheels',
        'Active Brake Assist',
      ],
      description: 'This 2021 Mercedes-Benz GLC 300 embodies luxury, performance, and cutting-edge technology. The elegant exterior design is complemented by a sophisticated interior featuring premium materials and the intuitive MBUX infotainment system. The 2.0L turbocharged engine provides responsive power while the 4MATIC all-wheel drive system ensures confident handling in various driving conditions. Additional features include a panoramic sunroof, Burmester sound system, and advanced safety technologies.',
      images: [
        'https://images.unsplash.com/photo-1563720223523-499bdf7317ed?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1617469767053-3ef70fe6c1a6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
      ],
      vin: 'WDCGG8JB5MF123456',
      engine: '2.0L Turbocharged I4',
      datePosted: 'July 9, 2:40 PM',
    },
  ];

  export default function App() {
    return (
      <div>
        <h1>Vehicle Inventory</h1>
        <p>We have {vehicles.length} vehicles available</p>
        <div>
          {vehicles.map((vehicle: Vehicle) => (
            <div key={vehicle.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
              <h3>{vehicle.title}</h3>
              <p>Price: {vehicle.price.toLocaleString()}</p>
              <p>Status: {vehicle.status}</p>
              <p>Location: {vehicle.location}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }`
        }
      ];
    } else {
      console.log('🤖 Calling AI to generate app...');
      return await createNewApp(description);
    }
  }
}