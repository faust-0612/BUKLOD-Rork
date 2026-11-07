// Node regression gate discovers tests/*.test.mjs; this imports the same source/data
// contract executed by npm run game:contract, avoiding duplicate test logic.
import '../scripts/test-kingdom-game-platform-r1.mjs';
