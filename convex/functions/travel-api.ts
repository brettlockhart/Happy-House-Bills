import { internal } from "../_generated/server";
import { v } from "convex/values";

export interface TravelConfig {
  provider: "skyscanner" | "expedia" | "travelport" | "mock";
  apiKey?: string;
}

export interface TravelFlight {
  id: string;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  arrivalDate: string;
  price: number;
  currency: string;
  status: "scheduled" | "delayed" | "cancelled" | "completed";
}

export interface TravelHotel {
  id: string;
  name: string;
  address: string;
  checkIn: string;
  checkOut: string;
  price: number;
  currency: string;
  status: "booked" | "cancelled" | "completed";
}

export interface TravelSyncResult {
  success: boolean;
  flights: TravelFlight[];
  hotels: TravelHotel[];
  newItems: number;
  error?: string;
}

export const testTravelConnection = internal({
  args: {
    provider: v.string(),
    credentials: v.any(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    switch (args.provider) {
      case "skyscanner": {
        const apiKey = (args.credentials as { api_key?: string })?.api_key;
        if (!apiKey) {
          return { success: false, error: "Missing Skyscanner api_key" };
        }
        return { success: true, error: undefined };
      }
      case "expedia": {
        const apiKey = (args.credentials as { api_key?: string })?.api_key;
        if (!apiKey) {
          return { success: false, error: "Missing Expedia api_key" };
        }
        return { success: true, error: undefined };
      }
      case "travelport": {
        const apiKey = (args.credentials as { api_key?: string })?.api_key;
        if (!apiKey) {
          return { success: false, error: "Missing Travelport api_key" };
        }
        return { success: true, error: undefined };
      }
      case "mock":
        return { success: true, error: undefined };
      default:
        return { success: false, error: `Unknown provider: ${args.provider}` };
    }
  },
});

export const syncTravelData = internal({
  args: {
    provider: v.string(),
    credentials: v.any(),
    orgId: v.string(),
  },
  handler: async (ctx, args): Promise<TravelSyncResult> => {
    const result: TravelSyncResult = {
      success: false,
      flights: [],
      hotels: [],
      newItems: 0,
    };

    switch (args.provider) {
      case "skyscanner": {
        const apiKey = (args.credentials as { api_key?: string })?.api_key;
        if (!apiKey) {
          result.error = "Missing Skyscanner api_key";
          return result;
        }
        await new Promise((r) => setTimeout(r, 1400));
        result.success = true;
        result.flights = [
          {
            id: "flt_1",
            flightNumber: "AA101",
            airline: "American Airlines",
            origin: "JFK",
            destination: "LAX",
            departureDate: new Date().toISOString().split("T")[0],
            arrivalDate: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().split("T")[0],
            price: 420.0,
            currency: "USD",
            status: "scheduled",
          },
          {
            id: "flt_2",
            flightNumber: "DL404",
            airline: "Delta",
            origin: "LAX",
            destination: "ORD",
            departureDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
            arrivalDate: new Date(Date.now() + 86400000 * 3 + 4 * 60 * 60 * 1000).toISOString().split("T")[0],
            price: 385.0,
            currency: "USD",
            status: "scheduled",
          },
        ];
        result.newItems = 2;
        return result;
      }
      case "expedia": {
        await new Promise((r) => setTimeout(r, 1100));
        result.success = true;
        result.hotels = [
          {
            id: "htl_1",
            name: "Grand Hotel",
            address: "123 Main St, New York, NY",
            checkIn: new Date().toISOString().split("T")[0],
            checkOut: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
            price: 299.0,
            currency: "USD",
            status: "booked",
          },
        ];
        result.newItems = 1;
        return result;
      }
      case "travelport": {
        await new Promise((r) => setTimeout(r, 1300));
        result.success = true;
        result.flights = [
          {
            id: "tp_flt_1",
            flightNumber: "TP500",
            airline: "TravelPort Air",
            origin: "SFO",
            destination: "SEA",
            departureDate: new Date().toISOString().split("T")[0],
            arrivalDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().split("T")[0],
            price: 210.0,
            currency: "USD",
            status: "scheduled",
          },
        ];
        result.newItems = 1;
        return result;
      }
      case "mock": {
        await new Promise((r) => setTimeout(r, 400));
        result.success = true;
        result.flights = [
          {
            id: "mock_flt_1",
            flightNumber: "MK1",
            airline: "Mock Air",
            origin: "NYC",
            destination: "CHI",
            departureDate: new Date().toISOString().split("T")[0],
            arrivalDate: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0],
            price: 150.0,
            currency: "USD",
            status: "scheduled",
          },
        ];
        result.newItems = 1;
        return result;
      }
      default:
        result.error = `Unknown provider: ${args.provider}`;
        return result;
    }
  },
});