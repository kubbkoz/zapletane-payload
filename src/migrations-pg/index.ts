import * as migration_20260914_194522_initial from './20260914_194522_initial';
import * as migration_20260914_194649_seed_admin from './20260914_194649_seed_admin';
import * as migration_20260914_201800_reset_admin_password from './20260914_201800_reset_admin_password';
import * as migration_20260914_204453_site_settings from './20260914_204453_site_settings';
import * as migration_20260914_210500_reset_admin_password_2 from './20260914_210500_reset_admin_password_2';
import * as migration_20260914_213000_eur_currency from './20260914_213000_eur_currency';
import * as migration_20260914_222406_shipping_payments from './20260914_222406_shipping_payments';
import * as migration_20260914_223000_mcp_shipping_payment_grants from './20260914_223000_mcp_shipping_payment_grants';
import * as migration_20260914_230125_content_management from './20260914_230125_content_management';
import * as migration_20260914_231500_content_defaults from './20260914_231500_content_defaults';
import * as migration_20260915_055107_x1_commerce_schema from './20260915_055107_x1_commerce_schema';
import * as migration_20260915_060000_x1_grants_and_search_defaults from './20260915_060000_x1_grants_and_search_defaults';
import * as migration_20260915_061452_x3_oauth_identity from './20260915_061452_x3_oauth_identity';
import * as migration_20260915_070141_y1_product_data from './20260915_070141_y1_product_data';
import * as migration_20260915_071500_y1_mcp_property_grants from './20260915_071500_y1_mcp_property_grants';
import * as migration_20260915_072320_y2_feeds_tracking from './20260915_072320_y2_feeds_tracking';
import * as migration_20260915_072600_y2_feed_grants from './20260915_072600_y2_feed_grants';
import * as migration_20260915_090322_z1_search_recommended from './20260915_090322_z1_search_recommended';
import * as migration_20260915_101312_z2_address_kind from './20260915_101312_z2_address_kind';
import * as migration_20260915_101404_z3_push_subscriptions from './20260915_101404_z3_push_subscriptions';
import * as migration_20260915_102926_z5_topbar from './20260915_102926_z5_topbar';
import * as migration_20260915_113059_z7_blog_slugs_redirects from './20260915_113059_z7_blog_slugs_redirects';
import * as migration_20260915_113500_z7_mcp_blog_redirect_grants from './20260915_113500_z7_mcp_blog_redirect_grants';
import * as migration_20260915_115308_z8_statistics from './20260915_115308_z8_statistics';
import * as migration_20260915_121302_z9_hero_video from './20260915_121302_z9_hero_video';
import * as migration_20260915_134529_z10_wishlist from './20260915_134529_z10_wishlist';
import * as migration_20260915_150558_z12_scraper from './20260915_150558_z12_scraper';
import * as migration_20260915_151000_z12_mcp_scraper_grants from './20260915_151000_z12_mcp_scraper_grants';
import * as migration_20260915_155500_z13_mcp_widen_all_keys from './20260915_155500_z13_mcp_widen_all_keys';

export const migrations = [
  {
    up: migration_20260914_194522_initial.up,
    down: migration_20260914_194522_initial.down,
    name: '20260914_194522_initial',
  },
  {
    up: migration_20260914_194649_seed_admin.up,
    down: migration_20260914_194649_seed_admin.down,
    name: '20260914_194649_seed_admin',
  },
  {
    up: migration_20260914_201800_reset_admin_password.up,
    down: migration_20260914_201800_reset_admin_password.down,
    name: '20260914_201800_reset_admin_password',
  },
  {
    up: migration_20260914_204453_site_settings.up,
    down: migration_20260914_204453_site_settings.down,
    name: '20260914_204453_site_settings',
  },
  {
    up: migration_20260914_210500_reset_admin_password_2.up,
    down: migration_20260914_210500_reset_admin_password_2.down,
    name: '20260914_210500_reset_admin_password_2',
  },
  {
    up: migration_20260914_213000_eur_currency.up,
    down: migration_20260914_213000_eur_currency.down,
    name: '20260914_213000_eur_currency',
  },
  {
    up: migration_20260914_222406_shipping_payments.up,
    down: migration_20260914_222406_shipping_payments.down,
    name: '20260914_222406_shipping_payments',
  },
  {
    up: migration_20260914_223000_mcp_shipping_payment_grants.up,
    down: migration_20260914_223000_mcp_shipping_payment_grants.down,
    name: '20260914_223000_mcp_shipping_payment_grants',
  },
  {
    up: migration_20260914_230125_content_management.up,
    down: migration_20260914_230125_content_management.down,
    name: '20260914_230125_content_management',
  },
  {
    up: migration_20260914_231500_content_defaults.up,
    down: migration_20260914_231500_content_defaults.down,
    name: '20260914_231500_content_defaults',
  },
  {
    up: migration_20260915_055107_x1_commerce_schema.up,
    down: migration_20260915_055107_x1_commerce_schema.down,
    name: '20260915_055107_x1_commerce_schema',
  },
  {
    up: migration_20260915_060000_x1_grants_and_search_defaults.up,
    down: migration_20260915_060000_x1_grants_and_search_defaults.down,
    name: '20260915_060000_x1_grants_and_search_defaults',
  },
  {
    up: migration_20260915_061452_x3_oauth_identity.up,
    down: migration_20260915_061452_x3_oauth_identity.down,
    name: '20260915_061452_x3_oauth_identity',
  },
  {
    up: migration_20260915_070141_y1_product_data.up,
    down: migration_20260915_070141_y1_product_data.down,
    name: '20260915_070141_y1_product_data',
  },
  {
    up: migration_20260915_071500_y1_mcp_property_grants.up,
    down: migration_20260915_071500_y1_mcp_property_grants.down,
    name: '20260915_071500_y1_mcp_property_grants',
  },
  {
    up: migration_20260915_072320_y2_feeds_tracking.up,
    down: migration_20260915_072320_y2_feeds_tracking.down,
    name: '20260915_072320_y2_feeds_tracking',
  },
  {
    up: migration_20260915_072600_y2_feed_grants.up,
    down: migration_20260915_072600_y2_feed_grants.down,
    name: '20260915_072600_y2_feed_grants',
  },
  {
    up: migration_20260915_090322_z1_search_recommended.up,
    down: migration_20260915_090322_z1_search_recommended.down,
    name: '20260915_090322_z1_search_recommended',
  },
  {
    up: migration_20260915_101312_z2_address_kind.up,
    down: migration_20260915_101312_z2_address_kind.down,
    name: '20260915_101312_z2_address_kind',
  },
  {
    up: migration_20260915_101404_z3_push_subscriptions.up,
    down: migration_20260915_101404_z3_push_subscriptions.down,
    name: '20260915_101404_z3_push_subscriptions',
  },
  {
    up: migration_20260915_102926_z5_topbar.up,
    down: migration_20260915_102926_z5_topbar.down,
    name: '20260915_102926_z5_topbar',
  },
  {
    up: migration_20260915_113059_z7_blog_slugs_redirects.up,
    down: migration_20260915_113059_z7_blog_slugs_redirects.down,
    name: '20260915_113059_z7_blog_slugs_redirects',
  },
  {
    up: migration_20260915_113500_z7_mcp_blog_redirect_grants.up,
    down: migration_20260915_113500_z7_mcp_blog_redirect_grants.down,
    name: '20260915_113500_z7_mcp_blog_redirect_grants',
  },
  {
    up: migration_20260915_115308_z8_statistics.up,
    down: migration_20260915_115308_z8_statistics.down,
    name: '20260915_115308_z8_statistics',
  },
  {
    up: migration_20260915_121302_z9_hero_video.up,
    down: migration_20260915_121302_z9_hero_video.down,
    name: '20260915_121302_z9_hero_video',
  },
  {
    up: migration_20260915_134529_z10_wishlist.up,
    down: migration_20260915_134529_z10_wishlist.down,
    name: '20260915_134529_z10_wishlist',
  },
  {
    up: migration_20260915_150558_z12_scraper.up,
    down: migration_20260915_150558_z12_scraper.down,
    name: '20260915_150558_z12_scraper',
  },
  {
    up: migration_20260915_151000_z12_mcp_scraper_grants.up,
    down: migration_20260915_151000_z12_mcp_scraper_grants.down,
    name: '20260915_151000_z12_mcp_scraper_grants'
  },
  {
    up: migration_20260915_155500_z13_mcp_widen_all_keys.up,
    down: migration_20260915_155500_z13_mcp_widen_all_keys.down,
    name: '20260915_155500_z13_mcp_widen_all_keys',
  },
];
