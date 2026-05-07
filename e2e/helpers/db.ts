import { execSync } from 'child_process'

/**
 * Re-seeds the development database.
 * The seed is idempotent (upsert-based) so it can be called multiple times safely.
 * Use in beforeAll() hooks when tests need a known baseline state.
 */
export function seedDatabase(): void {
  execSync('npx prisma db seed', { stdio: 'inherit' })
}
