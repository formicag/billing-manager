import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  IconButton,
  TextField,
  Toolbar,
  Typography,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiService from '../services/api';

const Settings = () => {
  const navigate = useNavigate();
  const [apiUrl, setApiUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Load current API URL from environment or default
    const currentUrl = process.env.REACT_APP_API_URL || 'http://localhost:8080';
    setApiUrl(currentUrl);
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setTesting(true);
    try {
      const health = await apiService.checkHealth();
      setHealthStatus(health);
    } catch (err) {
      setHealthStatus({ status: 'error', message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleUrlChange = (e) => {
    setApiUrl(e.target.value);
    setHasChanges(true);
  };

  const handleSave = () => {
    // Note: In a real app, you'd need to update the environment variable
    // or store this in localStorage/config. For now, we'll just show a message.
    toast.info('API URL configuration requires application restart to take effect');
    localStorage.setItem('REACT_APP_API_URL', apiUrl);
    setHasChanges(false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      // Temporarily test connection with new URL
      const response = await fetch(`${apiUrl}/api/health`);
      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data);
        toast.success('Connection test successful!');
      } else {
        throw new Error('Connection test failed');
      }
    } catch (err) {
      toast.error('Connection test failed: ' + err.message);
      setHealthStatus({ status: 'error', message: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="back"
            onClick={() => navigate('/')}
            edge="start"
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Settings
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        {/* API Configuration */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              API Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure the backend API endpoint for the billing manager.
            </Typography>

            <TextField
              fullWidth
              label="API Endpoint URL"
              value={apiUrl}
              onChange={handleUrlChange}
              placeholder="http://localhost:8080"
              helperText="Enter the full URL of the backend API server"
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={testing ? <CircularProgress size={16} /> : undefined}
                onClick={handleTestConnection}
                disabled={testing || !apiUrl}
              >
                Test Connection
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={!hasChanges}
              >
                Save
              </Button>
            </Box>

            {healthStatus && (
              <Alert
                severity={healthStatus.status === 'ok' ? 'success' : 'error'}
                icon={healthStatus.status === 'ok' ? <CheckIcon /> : <CloseIcon />}
              >
                <Box>
                  <Typography variant="body2">
                    Status: {healthStatus.status === 'ok' ? 'Connected' : 'Connection Failed'}
                  </Typography>
                  {healthStatus.message && (
                    <Typography variant="caption" display="block">
                      {healthStatus.message}
                    </Typography>
                  )}
                  {healthStatus.timestamp && (
                    <Typography variant="caption" display="block">
                      Last checked: {new Date(healthStatus.timestamp).toLocaleString()}
                    </Typography>
                  )}
                </Box>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Divider sx={{ my: 3 }} />

        {/* About Section */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              About
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body1" gutterBottom>
                Billing Manager
              </Typography>
              <Chip label="Version 1.0.0" size="small" sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" paragraph>
                A comprehensive cloud cost management platform for tracking and analyzing expenses across multiple cloud service providers.
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Supported Services
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                <Chip label="AWS" size="small" icon={<span>☁️</span>} />
                <Chip label="Google Cloud Platform" size="small" icon={<span>🔵</span>} />
                <Chip label="Atlassian" size="small" icon={<span>🔷</span>} />
                <Chip label="Google Workspace" size="small" icon={<span>📧</span>} />
                <Chip label="ChatGPT" size="small" icon={<span>🤖</span>} />
                <Chip label="Cohere" size="small" icon={<span>🧠</span>} />
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Features
              </Typography>
              <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                <Typography component="li" variant="body2" color="text.secondary">
                  Real-time cost tracking and monitoring
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Automated cost collection schedules
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Historical data backfill
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Cost breakdown by resources and tags
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Secure credential management
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Interactive charts and visualizations
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                System Information
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Frontend:</strong> React 18 with Material-UI
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Charts:</strong> Recharts
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Routing:</strong> React Router v6
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Theme:</strong> Dark Mode
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="body2" color="text.secondary" align="center">
                © 2024 Billing Manager. All rights reserved.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Settings;
