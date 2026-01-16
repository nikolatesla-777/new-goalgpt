
import { aiPredictionService } from '../services/ai/aiPrediction.service';
import { pool } from '../database/connection';

async function verifyCoupon() {
    try {
        console.log('Verifying Coupon Creation...');

        const couponData = {
            title: "Test Verification Coupon",
            access_type: "VIP" as const,
            items: [
                {
                    match_id: "test_match_1",
                    home_team: "Test Home 1",
                    away_team: "Test Away 1",
                    league: "Test League",
                    score: "0-0",
                    minute: 10,
                    prediction: "MS 1"
                },
                {
                    match_id: "test_match_2",
                    home_team: "Test Home 2",
                    away_team: "Test Away 2",
                    league: "Test League",
                    score: "1-1",
                    minute: 50,
                    prediction: "MS 2.5 ÜST"
                }
            ]
        };

        const result = await aiPredictionService.createCoupon(couponData);

        if (result && result.id) {
            console.log('✅ Coupon Service returned success:', result);

            // Verify in DB
            const couponRes = await pool.query('SELECT * FROM ai_coupons WHERE id = $1', [result.id]);
            const predsRes = await pool.query('SELECT * FROM ai_predictions WHERE coupon_id = $1', [result.id]);

            if (couponRes.rows.length === 1 && predsRes.rows.length === 2) {
                console.log('✅ Database verification successful!');
                console.log(`- Coupon ID: ${couponRes.rows[0].id}`);
                console.log(`- Linked Predictions: ${predsRes.rows.length}`);
            } else {
                console.error('❌ Database verification failed!');
                console.log('Coupon Rows:', couponRes.rows.length);
                console.log('Prediction Rows:', predsRes.rows.length);
            }

            // Cleanup
            await pool.query('DELETE FROM ai_predictions WHERE coupon_id = $1', [result.id]);
            await pool.query('DELETE FROM ai_coupons WHERE id = $1', [result.id]);
            console.log('✅ Cleanup successful');

        } else {
            console.error('❌ Service failed to create coupon');
        }

    } catch (error) {
        console.error('Verification Error:', error);
    } finally {
        process.exit();
    }
}

verifyCoupon();
