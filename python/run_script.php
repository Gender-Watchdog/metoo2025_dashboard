<?php
header('Content-Type: application/json');

// Check for POST request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get JSON data from the request
    $json_data = file_get_contents('php://input');
    $data = json_decode($json_data, true);
    
    // Validate the script parameter
    if (!isset($data['script']) || !preg_match('/^[a-zA-Z0-9_]+\.py$/', $data['script'])) {
        echo json_encode(['error' => 'Invalid script name']);
        exit();
    }
    
    $script = $data['script'];
    $script_path = __DIR__ . '/' . $script;
    
    // Check if the script exists
    if (!file_exists($script_path)) {
        echo json_encode(['error' => 'Script not found']);
        exit();
    }
    
    // Execute the Python script
    $output = [];
    $return_var = 0;
    
    exec("python3 " . escapeshellarg($script_path) . " 2>&1", $output, $return_var);
    
    if ($return_var === 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Script executed successfully',
            'output' => $output
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Script execution failed',
            'output' => $output,
            'return_code' => $return_var
        ]);
    }
} else {
    echo json_encode(['error' => 'Invalid request method']);
}
?> 