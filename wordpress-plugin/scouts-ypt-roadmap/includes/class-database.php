<?php
/**
 * class-database.php
 * Handles database persistence and retrieval for Scouts YPT Roadmap
 *
 * @package Scouts_YPT_Roadmap
 */

if (!defined('ABSPATH')) {
    exit;
}

class Scouts_YPT_Database {
    const OPTION_KEY = 'scouts_ypt_roadmap_data';
    const SETTINGS_KEY = 'scouts_ypt_roadmap_settings';

    /**
     * Get default settings
     */
    public static function get_settings() {
        $defaults = array(
            'url_slug'          => 'ypt-roadmap',
            'edit_permission'   => 'edit_posts', // 'anyone', 'logged_in', 'edit_posts', 'manage_options'
            'enable_shortcode'  => true,
            'poll_interval_sec' => 15
        );
        $settings = get_option(self::SETTINGS_KEY, array());
        return wp_parse_args($settings, $defaults);
    }

    /**
     * Update settings
     */
    public static function update_settings($new_settings) {
        $current = self::get_settings();
        $merged = wp_parse_args($new_settings, $current);
        return update_option(self::SETTINGS_KEY, $merged);
    }

    /**
     * Check if current user has permission to edit roadmap data
     */
    public static function current_user_can_edit() {
        $settings = self::get_settings();
        $perm = $settings['edit_permission'];

        if ($perm === 'anyone') {
            return true;
        }

        if ($perm === 'logged_in') {
            return is_user_logged_in();
        }

        if ($perm === 'manage_options') {
            return current_user_can('manage_options');
        }

        // Default: edit_posts (Editors & Admins)
        return current_user_can('edit_posts');
    }

    /**
     * Seed default data from JSON file on plugin activation
     */
    public static function init_default_data() {
        $existing = get_option(self::OPTION_KEY);
        if ($existing && !empty($existing['items'])) {
            return false; // Already has data
        }

        return self::reset_to_default_seed();
    }

    /**
     * Reset database back to default seed JSON
     */
    public static function reset_to_default_seed() {
        $seed_file = SCOUTS_YPT_PLUGIN_DIR . 'data/default-roadmap.json';
        if (file_exists($seed_file)) {
            $json_raw = file_get_contents($seed_file);
            $parsed = json_decode($json_raw, true);
            if ($parsed && !empty($parsed['items'])) {
                $payload = array(
                    'version'      => '2.1',
                    'lastSaved'    => current_time('mysql', 1),
                    'lastSavedBy'  => 'System Default',
                    'items'        => $parsed['items'],
                    'categories'   => !empty($parsed['categories']) ? $parsed['categories'] : self::get_default_categories(),
                    'blockouts'    => !empty($parsed['blockouts']) ? $parsed['blockouts'] : self::get_default_blockouts()
                );
                update_option(self::OPTION_KEY, $payload, false);
                return $payload;
            }
        }

        // Hardcoded minimal fallback
        $fallback = array(
            'version'     => '2.1',
            'lastSaved'   => current_time('mysql', 1),
            'lastSavedBy' => 'System Fallback',
            'items'       => array(),
            'categories'  => self::get_default_categories(),
            'blockouts'   => self::get_default_blockouts()
        );
        update_option(self::OPTION_KEY, $fallback, false);
        return $fallback;
    }

    /**
     * Retrieve complete roadmap dataset
     */
    public static function get_roadmap_data() {
        $data = get_option(self::OPTION_KEY);
        if (!$data || !is_array($data) || !isset($data['items'])) {
            return self::init_default_data();
        }

        // Ensure categories exist
        if (empty($data['categories']) || !is_array($data['categories'])) {
            $data['categories'] = self::get_default_categories();
        }

        // Ensure blockouts exist
        if (empty($data['blockouts']) || !is_array($data['blockouts'])) {
            $data['blockouts'] = self::get_default_blockouts();
        }

        return $data;
    }

    /**
     * Save roadmap dataset
     */
    public static function save_roadmap_data($payload, $user_name = '') {
        if (!is_array($payload)) {
            return new WP_Error('invalid_data', 'Payload must be an array or JSON object');
        }

        $items = isset($payload['items']) && is_array($payload['items']) ? $payload['items'] : array();
        $categories = isset($payload['categories']) && is_array($payload['categories']) ? $payload['categories'] : self::get_default_categories();
        $blockouts = isset($payload['blockouts']) && is_array($payload['blockouts']) ? $payload['blockouts'] : self::get_default_blockouts();

        if (empty($user_name)) {
            $current_user = wp_get_current_user();
            $user_name = $current_user && $current_user->ID ? $current_user->display_name : 'Guest';
        }

        $clean_data = array(
            'version'     => '2.1',
            'lastSaved'   => current_time('c', 1), // ISO 8601 UTC
            'lastSavedBy' => sanitize_text_field($user_name),
            'items'       => $items,
            'categories'  => $categories,
            'blockouts'   => $blockouts
        );

        $saved = update_option(self::OPTION_KEY, $clean_data, false);
        return array(
            'success'     => true,
            'count'       => count($items),
            'lastSaved'   => $clean_data['lastSaved'],
            'lastSavedBy' => $clean_data['lastSavedBy']
        );
    }

    /**
     * Get quick metadata status for polling
     */
    public static function get_status() {
        $data = self::get_roadmap_data();
        return array(
            'lastSaved'   => isset($data['lastSaved']) ? $data['lastSaved'] : '',
            'lastSavedBy' => isset($data['lastSavedBy']) ? $data['lastSavedBy'] : '',
            'count'       => isset($data['items']) ? count($data['items']) : 0,
            'serverTime'  => current_time('c', 1)
        );
    }

    public static function get_default_categories() {
        return array(
            'Youth Program Event'       => '#0284c7',
            'Branch Calendar Event'     => '#a43c51',
            'Event'                     => '#d97706',
            'Prep'                      => '#008f88',
            'Comms'                     => '#16a34a',
            'School Term'               => '#28265c',
            'School Holidays'           => '#0284c7',
            'Queensland Public Holiday' => '#ea580c',
            'Student-Free Day'          => '#6366f1',
            'Brisbane Public Holiday'   => '#c2410c',
            'Reference'                 => '#64748b'
        );
    }

    public static function get_default_blockouts() {
        return array(
            array(
                'id'        => 'bo-eoy-2026-2027',
                'title'     => 'EOY Branch Shutdown & Lockout',
                'startDate' => '2026-12-18',
                'endDate'   => '2027-01-18',
                'color'     => '#ef4444',
                'notes'     => 'Branch office closure and holiday lockout; avoid scheduling major branch events.'
            ),
            array(
                'id'        => 'bo-easter-2027',
                'title'     => 'Easter Camp & Activity Moratorium',
                'startDate' => '2027-03-26',
                'endDate'   => '2027-03-30',
                'color'     => '#f59e0b',
                'notes'     => 'Easter weekend blackout; major section camps in progress.'
            )
        );
    }
}
