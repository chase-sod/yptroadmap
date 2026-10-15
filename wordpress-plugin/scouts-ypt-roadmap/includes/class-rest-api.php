<?php
/**
 * class-rest-api.php
 * Registers official WordPress REST API endpoints for Scouts YPT Roadmap
 *
 * @package Scouts_YPT_Roadmap
 */

if (!defined('ABSPATH')) {
    exit;
}

class Scouts_YPT_REST_API {
    const NAMESPACE = 'scouts-ypt/v1';

    /**
     * Register REST API routes
     */
    public static function register_routes() {
        // GET /wp-json/scouts-ypt/v1/data
        register_rest_route(self::NAMESPACE, '/data', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array(__CLASS__, 'get_data'),
                'permission_callback' => array(__CLASS__, 'check_read_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array(__CLASS__, 'save_data'),
                'permission_callback' => array(__CLASS__, 'check_edit_permission'),
            )
        ));

        // GET /wp-json/scouts-ypt/v1/status (lightweight timestamp poll)
        register_rest_route(self::NAMESPACE, '/status', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array(__CLASS__, 'get_status'),
            'permission_callback' => array(__CLASS__, 'check_read_permission'),
        ));

        // POST /wp-json/scouts-ypt/v1/reset
        register_rest_route(self::NAMESPACE, '/reset', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array(__CLASS__, 'reset_data'),
            'permission_callback' => array(__CLASS__, 'check_admin_permission'),
        ));
    }

    /**
     * Read Permission Callback
     */
    public static function check_read_permission() {
        // Allow public read or check custom setting
        return true;
    }

    /**
     * Edit Permission Callback
     */
    public static function check_edit_permission($request) {
        return Scouts_YPT_Database::current_user_can_edit();
    }

    /**
     * Admin Permission Callback
     */
    public static function check_admin_permission() {
        return current_user_can('manage_options');
    }

    /**
     * GET /data handler
     */
    public static function get_data($request) {
        $data = Scouts_YPT_Database::get_roadmap_data();
        return new WP_REST_Response($data, 200);
    }

    /**
     * POST /data handler
     */
    public static function save_data($request) {
        $params = $request->get_json_params();
        if (empty($params)) {
            $params = $request->get_body_params();
        }

        if (empty($params)) {
            return new WP_Error('no_data', 'No roadmap payload received', array('status' => 400));
        }

        $current_user = wp_get_current_user();
        $user_name = $current_user && $current_user->ID ? $current_user->display_name : 'Team Member';

        $result = Scouts_YPT_Database::save_roadmap_data($params, $user_name);
        if (is_wp_error($result)) {
            return $result;
        }

        return new WP_REST_Response($result, 200);
    }

    /**
     * GET /status handler
     */
    public static function get_status($request) {
        $status = Scouts_YPT_Database::get_status();
        return new WP_REST_Response($status, 200);
    }

    /**
     * POST /reset handler
     */
    public static function reset_data($request) {
        $result = Scouts_YPT_Database::reset_to_default_seed();
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Roadmap reset to default master entries.',
            'count'   => count($result['items']),
            'data'    => $result
        ), 200);
    }
}
