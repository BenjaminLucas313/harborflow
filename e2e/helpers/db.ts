import { execSync } from 'child_process'

/**
 * Re-seeds the development database.
 * The seed is idempotent (upsert-based) so it can be called multiple times safely.
 * Use in beforeAll() hooks when tests need a known baseline state.
 */
export async function seedDatabase(): Promise<void> {
  execSync('npx prisma db seed', { stdio: 'inherit' })
}
