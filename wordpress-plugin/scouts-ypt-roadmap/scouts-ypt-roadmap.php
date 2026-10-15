<?php
/**
 * Plugin Name: Scouts QLD - Youth Program Team Roadmap
 * Plugin URI: https://github.com/chase-sod/yptroadmap
 * Description: Interactive, responsive multi-view roadmap and planner for Scouts Queensland Youth Program Team with real-time WordPress database persistence.
 * Version: 1.0.3
 * Author: Scouts Queensland Youth Program Team
 * Author URI: https://scoutsqld.com.au
 * License: GPL-2.0+
 * Text Domain: scouts-ypt-roadmap
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SCOUTS_YPT_VERSION', '1.0.3');
define('SCOUTS_YPT_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SCOUTS_YPT_PLUGIN_URL', plugin_dir_url(__FILE__));

// Require Core Classes
require_once SCOUTS_YPT_PLUGIN_DIR . 'includes/class-database.php';
require_once SCOUTS_YPT_PLUGIN_DIR . 'includes/class-rest-api.php';

class Scouts_YPT_Roadmap_Plugin {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Lifecycle
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));

        // Rewrite & Routing (Theme-Independent Page)
        add_action('init', array($this, 'add_rewrite_rules'));
        add_filter('query_vars', array($this, 'add_query_vars'));
        add_action('template_redirect', array($this, 'handle_template_redirect'));

        // REST API
        add_action('rest_api_init', array('Scouts_YPT_REST_API', 'register_routes'));

        // Shortcode
        add_shortcode('scouts_ypt_roadmap', array($this, 'render_shortcode'));

        // Admin Menu & Settings
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'handle_admin_actions'));
    }

    /**
     * Plugin Activation
     */
    public function activate() {
        Scouts_YPT_Database::init_default_data();
        $this->add_rewrite_rules();
        flush_rewrite_rules();
    }

    /**
     * Plugin Deactivation
     */
    public function deactivate() {
        flush_rewrite_rules();
    }

    /**
     * Register rewrite rule for standalone full-screen page
     */
    public function add_rewrite_rules() {
        $settings = Scouts_YPT_Database::get_settings();
        $slug = sanitize_title($settings['url_slug']);
        if (empty($slug)) $slug = 'ypt-roadmap';

        add_rewrite_rule('^' . $slug . '/?$', 'index.php?scouts_ypt_roadmap=1', 'top');
    }

    /**
     * Register custom query var
     */
    public function add_query_vars($vars) {
        $vars[] = 'scouts_ypt_roadmap';
        return $vars;
    }

    /**
     * Template redirect: Serves our 100% theme-independent standalone HTML
     */
    public function handle_template_redirect() {
        if (get_query_var('scouts_ypt_roadmap')) {
            // Prevent caching headers if user is logged in
            if (is_user_logged_in()) {
                nocache_headers();
            }

            include SCOUTS_YPT_PLUGIN_DIR . 'templates/standalone-dashboard.php';
            exit;
        }
    }

    /**
     * Shortcode: [scouts_ypt_roadmap]
     */
    public function render_shortcode($atts) {
        $a = shortcode_atts(array(
            'height' => '850px',
            'width'  => '100%'
        ), $atts);

        $settings = Scouts_YPT_Database::get_settings();
        $slug = sanitize_title($settings['url_slug']);
        $url = home_url('/' . $slug . '/');

        $html = '<div class="scouts-ypt-embed-wrapper" style="width:' . esc_attr($a['width']) . '; margin: 1rem 0;">';
        $html .= '<div style="margin-bottom: 0.5rem; display: flex; justify-content: flex-end;">';
        $html .= '<a href="' . esc_url($url) . '" target="_blank" style="font-size: 0.85rem; font-weight: 700; color: #008f88; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">⤢ Open Full Screen</a>';
        $html .= '</div>';
        $html .= '<iframe src="' . esc_url($url) . '" width="100%" height="' . esc_attr($a['height']) . '" frameborder="0" style="border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.06);" allowfullscreen></iframe>';
        $html .= '</div>';

        return $html;
    }

    /**
     * Add WordPress Admin Menu
     */
    public function add_admin_menu() {
        add_menu_page(
            'Scouts YPT Roadmap',
            'YPT Roadmap',
            'manage_options',
            'scouts-ypt-roadmap',
            array($this, 'render_admin_page'),
            'dashicons-calendar-alt',
            30
        );
    }

    /**
     * Handle Admin Settings Form Submissions
     */
    public function handle_admin_actions() {
        if (!current_user_can('manage_options')) return;

        // Save Settings
        if (isset($_POST['scouts_ypt_save_settings']) && check_admin_referer('scouts_ypt_settings_nonce')) {
            $slug = sanitize_title($_POST['url_slug']);
            if (empty($slug)) $slug = 'ypt-roadmap';

            $edit_perm = sanitize_text_field($_POST['edit_permission']);
            Scouts_YPT_Database::update_settings(array(
                'url_slug'        => $slug,
                'edit_permission' => $edit_perm
            ));

            $this->add_rewrite_rules();
            flush_rewrite_rules();

            add_settings_error('scouts_ypt_messages', 'settings_saved', 'Settings saved successfully. Rewrite rules updated.', 'updated');
        }

        // Reset to Default Seed
        if (isset($_POST['scouts_ypt_reset_seed']) && check_admin_referer('scouts_ypt_reset_nonce')) {
            $res = Scouts_YPT_Database::reset_to_default_seed();
            add_settings_error('scouts_ypt_messages', 'seed_reset', 'Roadmap has been successfully reset to default entries (' . count($res['items']) . ' items).', 'updated');
        }

        // Upload JSON Snapshot Restore
        if (isset($_POST['scouts_ypt_import_json']) && check_admin_referer('scouts_ypt_import_nonce')) {
            if (!empty($_FILES['json_file']['tmp_name'])) {
                $raw = file_get_contents($_FILES['json_file']['tmp_name']);
                $parsed = json_decode($raw, true);
                if ($parsed && !empty($parsed['items'])) {
                    $u = wp_get_current_user();
                    Scouts_YPT_Database::save_roadmap_data($parsed, $u ? $u->display_name : 'Admin Import');
                    add_settings_error('scouts_ypt_messages', 'json_imported', 'Successfully restored ' . count($parsed['items']) . ' items from JSON snapshot.', 'updated');
                } else {
                    add_settings_error('scouts_ypt_messages', 'json_error', 'Invalid JSON format. File must contain an items array.', 'error');
                }
            }
        }
    }

    /**
     * Render Admin Settings Page
     */
    public function render_admin_page() {
        $settings = Scouts_YPT_Database::get_settings();
        $slug = $settings['url_slug'];
        $live_url = home_url('/' . $slug . '/');
        $status = Scouts_YPT_Database::get_status();
        ?>
        <div class="wrap">
            <h1 style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="dashicons dashicons-calendar-alt" style="font-size: 2rem; width: 2rem; height: 2rem; color: #1c4270;"></span>
                Scouts Queensland - Youth Program Team Roadmap
            </h1>

            <?php settings_errors('scouts_ypt_messages'); ?>

            <!-- Status Card -->
            <div style="background: #ffffff; border-left: 4px solid #008f88; padding: 1.25rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 1.5rem 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h3 style="margin: 0 0 0.5rem 0; color: #1c4270;">Live Standalone Dashboard</h3>
                    <p style="margin: 0; font-size: 0.95rem; color: #475569;">
                        The dashboard is live on your site: 
                        <a href="<?php echo esc_url($live_url); ?>" target="_blank" style="font-weight: 700; color: #0284c7; text-decoration: underline;">
                            <?php echo esc_url($live_url); ?> ↗
                        </a>
                    </p>
                    <p style="margin: 0.35rem 0 0 0; font-size: 0.85rem; color: #64748b;">
                        Items in Database: <strong><?php echo esc_html($status['count']); ?></strong> | 
                        Last Saved: <strong><?php echo esc_html($status['lastSaved'] ? $status['lastSaved'] : 'Never'); ?></strong>
                        <?php if ($status['lastSavedBy']): ?>
                            by <em><?php echo esc_html($status['lastSavedBy']); ?></em>
                        <?php endif; ?>
                    </p>
                </div>
                <div>
                    <a href="<?php echo esc_url($live_url); ?>" target="_blank" class="button button-primary button-hero" style="background: #008f88; border-color: #007a74; display: inline-flex; align-items: center; gap: 0.4rem;">
                        <span class="dashicons dashicons-external" style="margin-top: 2px;"></span> Open Dashboard
                    </a>
                </div>
            </div>

            <!-- Settings Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; max-width: 1200px;">
                
                <!-- General Settings -->
                <div style="background: #ffffff; padding: 1.5rem; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <h2 style="margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; color: #1c4270;">Configuration</h2>
                    <form method="post" action="">
                        <?php wp_nonce_field('scouts_ypt_settings_nonce'); ?>
                        <table class="form-table" role="presentation">
                            <tr>
                                <th scope="row"><label for="url_slug">URL Slug</label></th>
                                <td>
                                    <code><?php echo esc_url(home_url('/')); ?></code>
                                    <input name="url_slug" type="text" id="url_slug" value="<?php echo esc_attr($slug); ?>" class="regular-text" style="width: 160px;">
                                    <code>/</code>
                                    <p class="description">The clean standalone page URL path.</p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="edit_permission">Who can Edit?</label></th>
                                <td>
                                    <select name="edit_permission" id="edit_permission">
                                        <option value="edit_posts" <?php selected($settings['edit_permission'], 'edit_posts'); ?>>Editors & Administrators (Recommended)</option>
                                        <option value="manage_options" <?php selected($settings['edit_permission'], 'manage_options'); ?>>Administrators Only</option>
                                        <option value="logged_in" <?php selected($settings['edit_permission'], 'logged_in'); ?>>Any Logged-in WordPress User</option>
                                        <option value="anyone" <?php selected($settings['edit_permission'], 'anyone'); ?>>Anyone with Page Access (No login required)</option>
                                    </select>
                                    <p class="description">Controls who can save changes directly to the WordPress database.</p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">Shortcode</th>
                                <td>
                                    <code>[scouts_ypt_roadmap]</code>
                                    <p class="description">Insert this shortcode into any standard WordPress page or post to embed the roadmap.</p>
                                </td>
                            </tr>
                        </table>
                        <p class="submit">
                            <button type="submit" name="scouts_ypt_save_settings" class="button button-primary">Save Settings</button>
                        </p>
                    </form>
                </div>

                <!-- Backup & Reset Actions -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    
                    <!-- Restore from JSON file -->
                    <div style="background: #ffffff; padding: 1.5rem; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <h2 style="margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; color: #1c4270;">Restore from JSON Snapshot</h2>
                        <p style="font-size: 0.85rem; color: #64748b;">Upload a previously exported <code>.json</code> roadmap backup to restore all items into the WordPress database.</p>
                        <form method="post" enctype="multipart/form-data" action="">
                            <?php wp_nonce_field('scouts_ypt_import_nonce'); ?>
                            <input type="file" name="json_file" accept=".json" required style="margin: 0.5rem 0;">
                            <p>
                                <button type="submit" name="scouts_ypt_import_json" class="button button-secondary">Upload & Restore Database</button>
                            </p>
                        </form>
                    </div>

                    <!-- Reset to Defaults -->
                    <div style="background: #ffffff; padding: 1.5rem; border-radius: 6px; border: 1px solid #fecaca; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <h2 style="margin-top: 0; border-bottom: 1px solid #fee2e2; padding-bottom: 0.5rem; color: #b91c1c;">Reset Default Seed</h2>
                        <p style="font-size: 0.85rem; color: #64748b;">Reset the entire roadmap back to the original 341 master events, default categories, and lockout dates bundled with the plugin.</p>
                        <form method="post" action="" onsubmit="return confirm('Are you sure you want to restore the default master entries? All custom edits will be replaced.');">
                            <?php wp_nonce_field('scouts_ypt_reset_nonce'); ?>
                            <button type="submit" name="scouts_ypt_reset_seed" class="button button-link-delete" style="color: #b91c1c; font-weight: 700;">
                                🔄 Restore Default Master Seed
                            </button>
                        </form>
                    </div>

                </div>

            </div>
        </div>
        <?php
    }
}

// Instantiate
Scouts_YPT_Roadmap_Plugin::get_instance();
