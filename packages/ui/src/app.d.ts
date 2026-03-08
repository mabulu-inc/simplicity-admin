declare global {
	namespace App {
		interface Locals {
			user?: {
				userId: string;
				email?: string;
				tenantId?: string;
				roles: string[];
				activeRole: string;
				superAdmin: boolean;
			};
		}
	}
}

export {};
